"""Development entrypoint.

    python run.py            # boots on :5000 with debug
    flask --app run.py shell
    flask --app run.py db migrate / upgrade
    flask --app run.py seed
"""
from app import create_app

app = create_app()

# Register the `flask --app run.py seed` CLI command.
from seed import seed as _seed_command  # noqa: E402

app.cli.add_command(_seed_command)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)