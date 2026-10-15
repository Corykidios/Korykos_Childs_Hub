"""DuckDuckGoose sim worker. Runs as a separate process; the ONLY package
allowed to import oasis/camel. MUST NOT import app.* — it is self-contained
and receives everything through its run directory."""
