import pytest


def test_challenge_fields_have_sources_and_valid_search_parameters(client):
    response = client.get("/api/v1/targets")
    assert response.status_code == 200
    targets = response.json()
    assert len(targets) == 5
    assert len({t["id"] for t in targets}) == 5
    for target in targets:
        assert target["coordinate_source"].startswith("https://")
        result = client.get(
            "/api/v1/observations",
            params={
                "ra": target["ra"],
                "dec": target["dec"],
                "radius_deg": target["radius_deg"],
            },
        )
        assert result.status_code == 200
    wise = next(t for t in targets if t["id"] == "wise-0855")
    assert wise["ra"] == pytest.approx(133.7951291667)
    assert wise["dec"] == pytest.approx(-7.2451472222)
