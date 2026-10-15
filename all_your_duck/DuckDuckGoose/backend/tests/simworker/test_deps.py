def test_oasis_importable():
    import oasis
    from oasis import ActionType, LLMAction, ManualAction  # noqa: F401

    assert hasattr(oasis, "make")


def test_camel_model_factory_accepts_explicit_endpoint():
    """The engine passes credentials as constructor params, never
    via env mutation. Verify the camel API surface we rely on exists."""
    import inspect

    from camel.models import ModelFactory

    sig = inspect.signature(ModelFactory.create)
    params = set(sig.parameters)
    assert "url" in params and "api_key" in params, (
        f"ModelFactory.create signature changed: {sorted(params)}"
    )


def test_simworker_package_importable_without_oasis_side_effects():
    import simworker  # noqa: F401
    import simworker.brains  # noqa: F401
