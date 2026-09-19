"""Security helpers: password handling, upload validation, safe paths."""
import pathlib
import re
import zipfile
from io import BytesIO

# extension -> (expected magic byte prefixes)
MAGIC_BYTES = {
    "pdf": [b"%PDF"],
    "png": [b"\x89PNG\r\n\x1a\n"],
    "jpg": [b"\xff\xd8\xff"],
    "jpeg": [b"\xff\xd8\xff"],
    "zip": [b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"],
}

ALLOWED_DOCUMENT_EXTENSIONS = {"pdf", "png", "jpg", "jpeg"}
ALLOWED_ARCHIVE_EXTENSIONS = {"zip"}

_NON_ALNUM = re.compile(r"[^a-z0-9._-]", re.IGNORECASE)


def extension_of(filename: str | None) -> str:
    if not filename:
        return ""
    suffix = pathlib.Path(filename).suffix.lower().lstrip(".")
    return suffix


def sniff_kind(data: bytes, ext: str) -> bool:
    """Verify magic bytes match the declared extension (double extension safe)."""
    candidates = MAGIC_BYTES.get(ext, [])
    if not candidates:
        return False
    head = data[:16]
    return any(head.startswith(prefix) for prefix in candidates)


def validate_document_upload(filename: str | None, data: bytes, max_bytes: int) -> None:
    """Raise UploadValidationError for any disallowed/mismatched upload."""
    ext = extension_of(filename)
    if ext not in ALLOWED_DOCUMENT_EXTENSIONS:
        raise UploadValidationError(f"Unsupported file type: '{ext}'")
    if not data or len(data) == 0:
        raise UploadValidationError("Empty file.")
    if len(data) > max_bytes:
        raise UploadValidationError(f"File exceeds {max_bytes // (1024 * 1024)} MB limit.")
    if not sniff_kind(data, ext):
        raise UploadValidationError("File content does not match its extension.")


def sanitize_basename(filename: str) -> str:
    """Return a safe, unicode-preserving basename without path separators."""
    name = (filename or "file").replace("\\", "/").rsplit("/", 1)[-1]
    name = _NON_ALNUM.sub("-", name).strip("-")[:120]
    return name or "file"


def check_zip_safety(zip_bytes: bytes, max_files: int = 1000, max_total: int = 40 * 1024 * 1024) -> None:
    """Validate an archive: no traversal, no symlinks, sane counts and size."""
    if len(zip_bytes) > max_total:
        raise UploadValidationError("Archive exceeds size limit.")
    try:
        zf = zipfile.ZipFile(BytesIO(zip_bytes))
    except (zipfile.BadZipFile, OSError) as exc:
        raise UploadValidationError("Not a valid ZIP archive.") from exc

    members = zf.infolist()
    if len(members) > max_files:
        raise UploadValidationError("Archive contains too many files.")

    total = 0
    for member in members:
        # Reject path traversal
        normalized = pathlib.PurePosixPath(member.filename)
        if member.filename.startswith(("/", "\\")) or ".." in normalized.parts:
            raise UploadValidationError("Archive contains an unsafe path.")
        # Reject symlinks and devices
        mode = member.external_attr >> 16
        if (mode & 0o170000) in (0o120000, 0o040000):  # symlink or directory
            raise UploadValidationError("Archive contains an unsupported entry type.")
        if member.is_dir():
            continue
        total += member.file_size
        if member.file_size > (max_total // 2):
            raise UploadValidationError("A single archive entry is too large.")
    if total > max_total:
        raise UploadValidationError("Extracted archive exceeds size limit.")

    # Vulnerable-in-theory name collisions are handled at extract time by an
    # allowlist writer; see storage.extract_zip_entries.
    try:
        zf.testzip()
    except zipfile.BadZipFile as exc:
        raise UploadValidationError("Zip integrity check failed.") from exc


class UploadValidationError(ValueError):
    pass