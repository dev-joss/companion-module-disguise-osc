# Unit tests

Run `yarn test` with Node.js 20 or later. The tests use the built-in Node.js test runner and the installed project dependencies. UDP ports are mocked. A Disguise server is not required.

The tests cover transport commands, cue arguments, master level limits, received variables, custom feedback, and the OSC receiver.

Regression tests cover variable resolution, shift actions, receiver startup, shutdown, timer cleanup, and reconnect order. The UDP close test uses the library's event-based close behavior.

Companion starts each module instance in a separate process. Tests that place multiple module instances in one process do not represent the supported runtime. See [Module Development 101](https://companion.free/for-developers/module-development/module-development-101/).

Numeric tests cover Track ID, Float Cue, custom OSC, layer actions, and master level steps. They check complete numeric input, variable resolution, and OSC integer and float limits.

Protocol references:

- [Controlling the Transport](https://help.disguise.one/designer/timeline-tracks-transports/osc/controlling): command addresses, argument types, and master level limits.
- [Triggering Cues with OSC](https://help.disguise.one/designer/timeline-tracks-transports/osc/triggering-cues-with-osc): one to three cue arguments of the same type, or one float cue argument.
- [Monitoring the Transport](https://help.disguise.one/designer/timeline-tracks-transports/osc/monitoring): received addresses and value types.
- [Monitoring using Custom Messages](https://help.disguise.one/designer/timeline-tracks-transports/osc/monitoring-custom): timecode format, section hint format, and fade status values.

The monitoring page lists `/d3/showcontrol/trackname` for both Track name and Track ID. The tests use `/d3/showcontrol/trackid` for Track ID, as used by the module and the control page.

Two decimal places for level variables, split timecode variables, empty section name defaults, play mode selections, and feedback comparisons are module behavior. The tests do not run Designer expressions or verify Designer cue lookup.
