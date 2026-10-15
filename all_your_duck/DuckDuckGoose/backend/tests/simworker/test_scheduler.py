import random

from simworker.scheduler import schedule_round

DIALS = {
    "minutes_per_round": 30,
    "agents_per_round_min": 2,
    "agents_per_round_max": 4,
    "peak_hours": [9, 20],
    "off_peak_hours": [3],
    "peak_multiplier": 1.5,
    "off_peak_multiplier": 0.3,
}


def _agents(n_crowd, tier="crowd_policy"):
    agents = [{"agent_uid": "agent_proto", "tier": "protagonist",
               "activity_level": 0.1, "active_hours": [0]}]
    for i in range(n_crowd):
        agents.append({
            "agent_uid": f"agent_c{i:03d}", "tier": tier,
            "activity_level": 1.0, "active_hours": list(range(24)),
        })
    return agents


def test_simulated_hour_advances():
    out0 = schedule_round(_agents(0), 0, DIALS, random.Random(1))
    out2 = schedule_round(_agents(0), 2, DIALS, random.Random(1))
    assert out0["hour"] == 0 and out2["hour"] == 1  # 2*30min = 1h


def test_protagonists_always_active_any_hour():
    # protagonist has activity 0.1 and active_hours=[0]; at hour 5 still active
    out = schedule_round(_agents(5), 10, DIALS, random.Random(1))
    routed = {d["agent_uid"]: d["route"] for d in out["decisions"]}
    assert routed["agent_proto"] == "llm_protagonist"


def test_crowd_sampled_to_target_range():
    out = schedule_round(_agents(50), 0, DIALS, random.Random(7))
    crowd = [d for d in out["decisions"] if d["route"] == "policy"]
    # target = uniform(2,4) * 1.0 at hour 0 (not peak/off-peak)
    assert 2 <= len(crowd) <= 4


def test_hour_gate_excludes_inactive_crowd():
    agents = _agents(5)
    for a in agents[1:]:
        a["active_hours"] = [23]  # never active at hour 0
    out = schedule_round(agents, 0, DIALS, random.Random(1))
    assert [d["route"] for d in out["decisions"]] == ["llm_protagonist"]


def test_routes_by_tier():
    agents = _agents(2, tier="crowd_llm") + [
        {"agent_uid": "agent_pol", "tier": "crowd_policy",
         "activity_level": 1.0, "active_hours": list(range(24))},
    ]
    out = schedule_round(agents, 0, dict(DIALS, agents_per_round_min=10,
                                         agents_per_round_max=10),
                         random.Random(1))
    routes = {d["agent_uid"]: d["route"] for d in out["decisions"]}
    assert routes["agent_c000"] == "llm_crowd"
    assert routes["agent_pol"] == "policy"


def test_deterministic_with_seed():
    a = schedule_round(_agents(30), 4, DIALS, random.Random(99))
    b = schedule_round(_agents(30), 4, DIALS, random.Random(99))
    assert a == b


def test_peak_multiplier_raises_target():
    # hour 9 is peak: uniform(2,4)*1.5 -> 3..6
    counts = []
    for seed in range(20):
        out = schedule_round(_agents(50), 18, DIALS, random.Random(seed))
        counts.append(
            len([d for d in out["decisions"] if d["route"] == "policy"])
        )
    assert max(counts) > 4  # exceeds the non-peak max
