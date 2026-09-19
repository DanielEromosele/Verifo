"""Upload validation: magic bytes, extensions, archives, paths."""
import io
import zipfile

import pytest

from app.services.security import (
    UploadValidationError,
    check_zip_safety,
    sanitize_basename,
    sniff_kind,
    validate_document_upload,
)

MAX = 5 * 1024 * 1024


def test_accepts_real_magic_bytes():
    assert sniff_kind(b"%PDF-1.7 ...", "pdf")
    assert sniff_kind(b"\x89PNG\r\n\x1a\nxxxx", "png")
    assert sniff_kind(b"\xff\xd8\xff\xe0", "jpg")


def test_rejects_extension_mask():
    # HTML disguised as .pdf
    with pytest.raises(UploadValidationError):
        validate_document_upload("doc.pdf", b"<html><script>alert(1)</script>", MAX)
    # .exe renamed to .png
    with pytest.raises(UploadValidationError):
        validate_document_upload("img.png", b"MZ\x90\x00\x00\x00", MAX)
    # PNG renamed to .pdf
    with pytest.raises(UploadValidationError):
        validate_document_upload("doc.pdf", b"\x89PNG\r\n\x1a\n", MAX)


def test_rejects_disallowed_extension():
    with pytest.raises(UploadValidationError):
        validate_document_upload("script.js", b"%PDF-1.7", MAX)


def test_rejects_oversize():
    big = b"%PDF-1.7" + b"0" * (MAX + 1)
    with pytest.raises(UploadValidationError):
        validate_document_upload("doc.pdf", big, MAX)


def test_sanitize_basename_strips_paths():
    # Only the final basename is kept; traversal and separators are stripped.
    assert sanitize_basename("../../etc/passwd") == "passwd"
    assert sanitize_basename("a\\b\\c.txt") == "c.txt"
    assert sanitize_basename("   ") == "file"
    assert sanitize_basename("附件.pdf")  # unicode tolerated


def test_zip_safety_rejects_traversal(zip_bytes):
    with pytest.raises(UploadValidationError):
        check_zip_safety(zip_bytes("evil.zip", [("../evil.txt", b"x")]))


def test_zip_safety_rejects_too_many_files():
    # 1500 named members but trickily the infolist must be big -> build minimal
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        # zipfile only writes on close for small writes; write enough files
        for i in range(1001):
            zf.writestr(f"f{i:05d}.txt", b"")
    check_zip_safety_caught = False
    try:
        check_zip_safety(buf.getvalue(), max_files=1000)
    except UploadValidationError:
        check_zip_safety_caught = True
    assert check_zip_safety_caught


def test_zip_safety_accepts_valid_archive():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("a.txt", b"hello")
        zf.writestr("sub/b.pdf", b"%PDF-1.7")
    # must not raise
    check_zip_safety(buf.getvalue())


@pytest.fixture()
def zip_bytes():
    def build(name, members):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "x") as zf:
            for arcname, content in members:
                zf.writestr(arcname, content)
        return buf.getvalue()

    return build