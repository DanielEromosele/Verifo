"""Single-process entrypoint: web app + embedded background worker (+ optional seed).

Runs the Flask application, the background queue worker thread, and (when
VERIFO_SEED=1) the seeder in ONE process. Replaces the old two-window setup
(run.py + `flask --app run.py run-worker`) for local use and for Render.

    python server.py                    # seed (if flagged) + worker + web app
    python server.py --worker-only      # only the queue worker (blocking)  [dedicated Render worker service]
    python server.py --port 8080        # override port
    gunicorn server:app                 # WSGI entry (no embedded worker)

Environment:
    VERIFO_SEED         "1" -> run seed_demo.run_seed() on boot (respects SEED_SAMPLE)
    VERIFO_EMBED_WORKER "0" -> skip the embedded worker thread
    PORT / HOST         bind address for hosted platforms (Render sets PORT)
    FLASK_DEBUG         "1" -> debug/tracebacks (reloader stays OFF: the single
                              process owns the worker thread)
"""
import argparse
import signal
import threading

from app import create_app


def _flag(name: str, default: str = "0") -> bool:
    return os_env(name, default).strip().lower() in ("1", "true", "yes", "on")


def os_env(name: str, default: str = "") -> str:
    import os

    return os.environ.get(name, default)


def build_app():
    """Create the app, ensure tables exist, and seed if VERIFO_SEED=1."""
    app = create_app()
    with app.app_context():
        from app.extensions import db

        db.create_all()
        if _flag("VERIFO_SEED"):
            from seed_demo import run_seed

            result = run_seed()
            app.logger.info(
                "Seeded on boot (%s) org=%s", result["mode"], result["organization"])
    return app


app = build_app()


def start_embedded_worker():
    """Start the queue worker as a daemon thread (one process = web + worker)."""
    from app.services.worker import start_worker

    return start_worker(app)


def run_worker_blocking():
    """Block forever processing queue tasks (Windows-safe signal handling)."""
    from app.services.worker import worker_loop

    stop = threading.Event()
    signal.signal(signal.SIGINT, lambda *_: stop.set())
    signal.signal(signal.SIGTERM, lambda *_: stop.set())
    worker_loop(app, stop_event=stop)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Verifo unified entrypoint")
    parser.add_argument("--worker-only", action="store_true",
                        help="Run only the queue worker (blocking).")
    parser.add_argument("--host", default=None, help="Bind host (default: PORT set -> 0.0.0.0, else 127.0.0.1).")
    parser.add_argument("--port", type=int, default=None, help="Bind port (default: PORT env or 5000).")
    parser.add_argument("--debug", action="store_true", default=None,
                        help="Force debug mode (default: FLASK_DEBUG env).")
    args = parser.parse_args(argv)

    if args.worker_only:
        run_worker_blocking()
        return

    if _flag("VERIFO_EMBED_WORKER", "1"):
        start_embedded_worker()
        app.logger.info("Embedded queue worker started (thread).")

    host = args.host or os_env("HOST") or (
        "0.0.0.0" if os_env("PORT") else "127.0.0.1")
    port = args.port or int(os_env("PORT") or 5000)
    debug = _flag("FLASK_DEBUG", "0") if args.debug is None else args.debug
    # use_reloader=False: this process owns the worker thread, so web and worker
    # must stay in the same process (the reloader would split them again).
    app.run(host=host, port=port, debug=debug, threaded=True, use_reloader=False)


if __name__ == "__main__":
    main()