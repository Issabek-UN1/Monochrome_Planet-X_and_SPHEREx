from concurrent.futures import ThreadPoolExecutor

from spherex.models import JobRequest
from spherex.storage import Store


def test_claim_atomic_and_recovers_expired_lease(tmp_path):
    store = Store(tmp_path)
    job = store.enqueue(JobRequest(kind="cutout", observation_ids=["a" * 24], ra=0, dec=0), 10)
    with ThreadPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(lambda n: store.claim(str(n), 60), range(4)))
    claimed = [j for j in results if j is not None]
    assert len(claimed) == 1
    assert claimed[0].id == job.id
    with store.connection() as db:
        db.execute("UPDATE jobs SET lease_until=0 WHERE id=?", (job.id,))
    recovered = store.claim("replacement", 60)
    assert recovered.id == job.id
    assert recovered.attempts == 2
    store.finish(job.id, "wrong-owner", [], [], error="must not overwrite")
    assert store.job(job.id).status == "running"
    store.finish(job.id, "replacement", [], [], error="test failure")
    assert store.job(job.id).status == "failed"
