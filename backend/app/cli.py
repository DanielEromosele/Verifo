"""Flask CLI commands: worker, DB init convenience, demo seed."""
import click


def register_cli(app):
    @app.cli.command("run-worker")
    def run_worker():
        """Run the background queue worker in this process (blocking)."""
        from .services.worker import worker_loop

        click.echo("Verifo worker started (Ctrl+C to stop).")
        import signal
        import threading

        stop = threading.Event()
        signal.signal(signal.SIGINT, lambda *_: stop.set())
        signal.signal(signal.SIGTERM, lambda *_: stop.set())
        worker_loop(app, stop_event=stop)

    @app.cli.command("seed-demo")
    def seed_demo():
        """Create the demo organization, users, document types, and fixtures."""
        from app.extensions import db
        from .seed_demo import seed_demo

        db.create_all()
        seed_demo()
        click.echo("Demo seed complete.")

    @app.cli.command("create-all")
    def create_all():
        """Create all tables (dev convenience; migrations are preferred)."""
        from .extensions import db

        db.create_all()
        click.echo("Created all tables.")