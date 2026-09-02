from lib.config import Config, ConfigStore


def test_controller_preset_guids_are_normalized():
    config = Config(controller_presets={"ABCDEF": "playstation"})

    assert config.controller_presets == {"abcdef": "playstation"}


def test_invalid_controller_preset_update_is_ignored():
    store = ConfigStore(Config(controller_presets={"guid": "xbox"}))

    changed = store.update({"controller_presets": ["not", "a", "mapping"]})

    assert changed == {}
    assert store.config.controller_presets == {"guid": "xbox"}
