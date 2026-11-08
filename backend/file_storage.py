"""Private Vercel Blob uploads; local files remain supported in development."""
import os
from pathlib import Path

UPLOAD_FOLDER = Path(__file__).with_name("uploads") / "portfolio"
MAX_FILE_SIZE = 4 * 1024 * 1024


def uses_blob():
    return bool(os.getenv("BLOB_READ_WRITE_TOKEN") or os.getenv("BLOB_STORE_ID"))


def save_file(name, data):
    if uses_blob():
        from vercel.blob import sync as blob
        blob.put_blob("portfolio/" + name, data, access="private", content_type="application/octet-stream")
    else:
        if os.getenv("VERCEL"):
            raise RuntimeError("Private Blob storage must be configured")
        UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
        (UPLOAD_FOLDER / name).write_bytes(data)


def read_file(name):
    if Path(name).name != name or "/" in name or "\\" in name:
        raise FileNotFoundError(name)
    if uses_blob():
        from vercel.blob import sync as blob
        return blob.get_blob("portfolio/" + name, access="private").body
    return (UPLOAD_FOLDER / name).read_bytes()


def delete_file(name):
    if uses_blob():
        from vercel.blob import sync as blob
        blob.delete_blob("portfolio/" + name)
    else:
        (UPLOAD_FOLDER / name).unlink(missing_ok=True)
