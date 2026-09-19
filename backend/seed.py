"""Flask CLI seed command.

    flask --app run.py seed                 # respects SEED_SAMPLE
    $env:SEED_SAMPLE=1; flask --app run.py seed
    flask --app run.py seed --force-sample

Delegates all logic to seed_demo.py, the single source of truth for seeding.
"""
import click

from app import create_app


@click.command("seed")
@click.option("--force-sample", is_flag=True, help="Force full demo fixtures.")
@click.option("--force-bootstrap", is_flag=True, help="Force bootstrap only.")
def seed(force_sample, force_bootstrap):
    from seed_demo import run_seed

    if force_sample and force_bootstrap:
        click.echo("Pick one of --force-sample / --force-bootstrap.")
        raise click.Abort()
    with create_app().app_context():
        result = run_seed(
            sample=True if force_sample else (False if force_bootstrap else None)
        )
    click.echo(f"Seed complete [{result['mode']}] org='{result['organization']}'")


if __name__ == "__main__":
    seed()