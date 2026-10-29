const choices = require('./choices')
const utils = require('./utils')

function parseOscInteger(input) {
	if (typeof input !== 'string' && typeof input !== 'number') return NaN
	const text = String(input).trim()
	if (!/^[-+]?\d+$/.test(text)) return NaN
	const value = Number(text)
	return value >= -2147483648 && value <= 2147483647 ? value : NaN
}

function parseOscFloat(input) {
	if (typeof input !== 'string' && typeof input !== 'number') return NaN
	const text = String(input).trim()
	if (!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(text)) return NaN
	const value = Number(text)
	return Number.isFinite(Math.fround(value)) ? value : NaN
}

exports.initActions = function () {
	let self = this
	let actions = {}

	const showcontrol_base_address = '/d3/showcontrol/'
	const layer_base_address = '/d3/layer/'

	const sendNumericOsc = (path, input, parseValue, type) => {
		const value = parseValue(input)
		if (Number.isNaN(value)) {
			this.log('error', `Invalid numeric OSC value for ${path}.`)
			return
		}
		this.sendOscMessage(path, [{ type, value }])
	}

	const adjustLevel = (level, direction) => async (event, context) => {
		const id = `${direction}_${level}`
		let input = event.options.float
		if (context && context.parseVariablesInString) {
			input = await context.parseVariablesInString(input)
			this.log('debug', `[${id}] parsed variable: ${input}`)
		} else {
			this.log('debug', `[${id}] using raw value: ${input}`)
		}
		const current = parseOscFloat(this.getVariableValue(level))
		const step = parseOscFloat(input)
		if (Number.isNaN(current) || Number.isNaN(step)) {
			this.log('error', `[${id}] Invalid ${level} or step.`)
			return
		}
		const decrease = direction === 'decrement' || (direction === 'shift' && utils.shift)
		const value = decrease ? utils.decrement_float(current, step) : utils.increment_float(current, step)
		sendNumericOsc(`${showcontrol_base_address}${level}`, value, parseOscFloat, 'f')
	}

	// utility actions
	actions['shift'] = {
		name: 'Toggle shift',
		options: [],
		callback: () => {
			utils.shift = !utils.shift
			self.checkFeedbacks()
		},
	}
	// showcontrol actions
	actions['play'] = {
		name: 'Play',
		options: [],
		callback: () => {
			const path = `${showcontrol_base_address}play`

			this.sendOscMessage(path, [])
		},
	}
	actions['playsection'] = {
		name: 'Play to end of section',
		options: [],
		callback: () => {
			const path = `${showcontrol_base_address}playsection`

			this.sendOscMessage(path, [])
		},
	}
	actions['loopsection'] = {
		name: 'Loop section',
		options: [],
		callback: () => {
			const path = `${showcontrol_base_address}loop`

			this.sendOscMessage(path, [])
		},
	}
	actions['stop'] = {
		name: 'Stop',
		options: [],
		callback: () => {
			const path = `${showcontrol_base_address}stop`

			this.sendOscMessage(path, [])
		},
	}
	actions['previoussection'] = {
		name: 'Previous section',
		options: [],
		callback: () => {
			const path = `${showcontrol_base_address}previoussection`

			this.sendOscMessage(path, [])
		},
	}
	actions['nextsection'] = {
		name: 'Next section',
		options: [],
		callback: () => {
			const path = `${showcontrol_base_address}nextsection`

			this.sendOscMessage(path, [])
		},
	}
	actions['returntostart'] = {
		name: 'Return to start',
		options: [],
		callback: () => {
			const path = `${showcontrol_base_address}returntostart`

			this.sendOscMessage(path, [])
		},
	}
	actions['previoustrack'] = {
		name: 'Previous track',
		options: [],
		callback: () => {
			const path = `${showcontrol_base_address}previoustrack`

			this.sendOscMessage(path, [])
		},
	}
	actions['nexttrack'] = {
		name: 'Next track',
		options: [],
		callback: () => {
			const path = `${showcontrol_base_address}nexttrack`

			this.sendOscMessage(path, [])
		},
	}
	actions['trackname'] = {
		name: 'Track name',
		options: [
			{
				type: 'textinput',
				label: 'Track name (string)',
				id: 'string',
				default: 'text',
				useVariables: true,
			},
		],
		callback: async (event, context) => {
			const path = `${showcontrol_base_address}trackname`
			let trackName = event.options.string
			if (context && context.parseVariablesInString) {
				trackName = await context.parseVariablesInString(trackName)
			}
			this.sendOscMessage(path, [
				{
					type: 's',
					value: '' + trackName,
				},
			])
		},
	}
	actions['trackid'] = {
		name: 'Track ID',
		options: [
			{
				type: 'textinput',
				label: 'Track ID (integer)',
				id: 'int',
				default: 1,
				regex: /^[-+]?\d+$|^\$\(.+\)$/,
				useVariables: true,
			},
		],
		callback: async (action, context) => {
			const path = `${showcontrol_base_address}trackid`
			let intStr = action.options.int
			if (context && context.parseVariablesInString) {
				intStr = await context.parseVariablesInString(intStr)
				this.log('debug', `[trackid] parsed variable: ${intStr}`)
			} else {
				this.log('debug', `[trackid] using raw value: ${intStr}`)
			}
			const intVal = parseOscInteger(intStr)
			this.log('debug', `[trackid] final int value: ${intVal}`)
			if (isNaN(intVal)) {
				this.log('debug', '[trackid] Invalid OSC integer, aborting')
				return
			}
			this.sendOscMessage(path, [
				{
					type: 'i',
					value: intVal,
				},
			])
		},
	}
	actions['cue'] = {
		name: 'Cue',
		options: [
			{
				type: 'textinput',
				label: 'Cue (integer parts or variable)',
				id: 'int',
				default: 1,
				regex: /^\d+(?:\.\d+){0,2}$|^\$\(.+\)$/,
				useVariables: true,
				tooltip: 'Enter 1 to 3 unsigned integers separated by dots, e.g. 1.2.5, or a variable with this value.',
				error: 'Enter 1 to 3 unsigned integers separated by dots, or a variable with this value.',
			},
		],
		callback: async (action, context) => {
			const path = `${showcontrol_base_address}cue`
			// Always resolve variables using parseVariablesInString for compatibility
			let intStr = action.options.int
			if (context && context.parseVariablesInString) {
				intStr = await context.parseVariablesInString(intStr)
				this.log('debug', `[cue] parsed variable: ${intStr}`)
			} else {
				this.log('debug', `[cue] using raw value: ${intStr}`)
			}
			const cue = String(intStr).trim()
			if (!/^\d+(?:\.\d+){0,2}$/.test(cue)) {
				this.log('error', '[cue] Enter 1 to 3 unsigned integers separated by dots.')
				return
			}
			const parts = cue.split('.').map(Number)
			if (parts.some((part) => part > 2147483647)) {
				this.log('error', '[cue] Each part must be between 0 and 2147483647.')
				return
			}
			this.sendOscMessage(
				path,
				parts.map((value) => ({ type: 'i', value })),
			)
		},
	}
	actions['floatcue'] = {
		name: 'Float Cue',
		options: [
			{
				type: 'textinput',
				label: 'Float Cue (float or variable)',
				id: 'float',
				default: 1.0,
				regex: /^[-+]?\d*\.?\d+(e[-+]?\d+)?$|^\$\(.+\)$/,
				useVariables: true,
				tooltip: 'Enter a float or a variable that resolves to a float.',
				error: 'Please enter a valid float or variable that resolves to a float.',
			},
		],
		callback: async (action, context) => {
			const path = `${showcontrol_base_address}floatcue`
			let floatStr = action.options.float
			if (context && context.parseVariablesInString) {
				floatStr = await context.parseVariablesInString(floatStr)
			}
			const floatVal = parseOscFloat(floatStr)
			if (isNaN(floatVal)) {
				return
			}
			this.sendOscMessage(path, [
				{
					type: 'f',
					value: floatVal,
				},
			])
		},
	}
	actions['fadeup'] = {
		name: 'Fade up',
		options: [],
		callback: () => {
			const path = `${showcontrol_base_address}fadeup`

			this.sendOscMessage(path, [])
		},
	}
	actions['fadedown'] = {
		name: 'Fade down',
		options: [],
		callback: () => {
			const path = `${showcontrol_base_address}fadedown`

			this.sendOscMessage(path, [])
		},
	}
	actions['hold'] = {
		name: 'Hold',
		options: [],
		callback: () => {
			const path = `${showcontrol_base_address}hold`

			this.sendOscMessage(path, [])
		},
	}
	actions['shift_brightness'] = {
		name: 'Shift aware brightness',
		options: [
			{
				type: 'textinput',
				label: 'Step (float)',
				id: 'float',
				default: 0.01,
				max: 1,
				min: 0,
				step: 0.01,
				regex: /^[-+]?\d*\.?\d+(e[-+]?\d+)?$|^\$\(.+\)$/,
				useVariables: true,
			},
		],
		callback: adjustLevel('brightness', 'shift'),
	}
	actions['increment_brightness'] = {
		name: 'Increase brightness',
		options: [
			{
				type: 'textinput',
				label: 'Step (float)',
				id: 'float',
				default: 0.01,
				max: 1,
				min: 0,
				step: 0.01,
				regex: /^[-+]?\d*\.?\d+(e[-+]?\d+)?$|^\$\(.+\)$/,
				useVariables: true,
			},
		],
		callback: adjustLevel('brightness', 'increment'),
	}
	actions['decrement_brightness'] = {
		name: 'Decrease brightness',
		options: [
			{
				type: 'textinput',
				label: 'Step (float)',
				id: 'float',
				default: 0.01,
				max: 1,
				min: 0,
				step: 0.01,
				regex: /^[-+]?\d*\.?\d+(e[-+]?\d+)?$|^\$\(.+\)$/,
				useVariables: true,
			},
		],
		callback: adjustLevel('brightness', 'decrement'),
	}
	actions['shift_volume'] = {
		name: 'Shift aware volume',
		options: [
			{
				type: 'textinput',
				label: 'Step (float)',
				id: 'float',
				default: 0.01,
				max: 1,
				min: 0,
				step: 0.01,
				regex: /^[-+]?\d*\.?\d+(e[-+]?\d+)?$|^\$\(.+\)$/,
				useVariables: true,
			},
		],
		callback: adjustLevel('volume', 'shift'),
	}
	actions['increment_volume'] = {
		name: 'Increase volume',
		options: [
			{
				type: 'textinput',
				label: 'Step (float)',
				id: 'float',
				default: 0.01,
				max: 1,
				min: 0,
				step: 0.01,
				regex: /^[-+]?\d*\.?\d+(e[-+]?\d+)?$|^\$\(.+\)$/,
				useVariables: true,
			},
		],
		callback: adjustLevel('volume', 'increment'),
	}
	actions['decrement_volume'] = {
		name: 'Decrease volume',
		options: [
			{
				type: 'textinput',
				label: 'Step (float)',
				id: 'float',
				default: 0.01,
				max: 1,
				min: 0,
				step: 0.01,
				regex: /^[-+]?\d*\.?\d+(e[-+]?\d+)?$|^\$\(.+\)$/,
				useVariables: true,
			},
		],
		callback: adjustLevel('volume', 'decrement'),
	}
	// layer control actions
	actions['layer_blendmode'] = {
		name: 'Layer blendmode',
		options: [
			{
				type: 'textinput',
				label: 'Base address:',
				id: 'base_address',
				default: layer_base_address,
				useVariables: true,
			},
			{
				type: 'textinput',
				label: 'Layer name:',
				id: 'layer_name',
				default: 'video',
				useVariables: true,
			},
			{
				type: 'dropdown',
				id: 'mode',
				label: 'Blendmode:',
				default: '00',
				choices: choices.BLENDMODE,
			},
		],
		callback: async (event) => {
			const base_address = await this.parseVariablesInString(event.options.base_address)
			const layer = await this.parseVariablesInString(event.options.layer_name)
			const path = `${base_address}${layer}/blendmode`
			const int = await this.parseVariablesInString(event.options.mode)
			sendNumericOsc(path, int, parseOscInteger, 'i')
		},
	}
	actions['layer_brightness'] = {
		name: 'Layer brightness',
		options: [
			{
				type: 'textinput',
				label: 'Base address:',
				id: 'base_address',
				default: layer_base_address,
				useVariables: true,
			},
			{
				type: 'textinput',
				label: 'Layer name:',
				id: 'layer_name',
				default: 'video',
				useVariables: true,
			},
			{
				type: 'textinput',
				label: 'Brightness (float)',
				id: 'float',
				default: 1,
				max: 1,
				min: 0,
				regex: /^[-+]?\d*\.?\d+(e[-+]?\d+)?$|^\$\(.+\)$/,
				useVariables: true,
			},
		],
		callback: async (event) => {
			const base_address = await this.parseVariablesInString(event.options.base_address)
			const layer = await this.parseVariablesInString(event.options.layer_name)
			const path = `${base_address}${layer}/brightness`
			const float = await this.parseVariablesInString(event.options.float)
			sendNumericOsc(path, float, parseOscFloat, 'f')
		},
	}
	actions['layer_tint'] = {
		name: 'Layer tint',
		options: [
			{
				type: 'textinput',
				label: 'Base address:',
				id: 'base_address',
				default: layer_base_address,
				useVariables: true,
			},
			{
				type: 'textinput',
				label: 'Layer name:',
				id: 'layer_name',
				default: 'video',
				useVariables: true,
			},
			{
				type: 'dropdown',
				id: 'channel',
				label: 'Channel:',
				default: 'r',
				choices: choices.TINT,
			},
			{
				type: 'textinput',
				label: 'Tint (float)',
				id: 'float',
				default: 1,
				max: 1,
				min: 0,
				step: 0.01,
				regex: /^[-+]?\d*\.?\d+(e[-+]?\d+)?$|^\$\(.+\)$/,
				useVariables: true,
			},
		],
		callback: async (event) => {
			const base_address = await this.parseVariablesInString(event.options.base_address)
			const layer = await this.parseVariablesInString(event.options.layer_name)
			const channel = await this.parseVariablesInString(event.options.channel)
			const path = `${base_address}${layer}/tint.${channel}`
			const float = await this.parseVariablesInString(event.options.float)
			sendNumericOsc(path, float, parseOscFloat, 'f')
		},
	}
	actions['layer_speed'] = {
		name: 'Layer speed',
		options: [
			{
				type: 'textinput',
				label: 'Base address:',
				id: 'base_address',
				default: layer_base_address,
				useVariables: true,
			},
			{
				type: 'textinput',
				label: 'Layer name:',
				id: 'layer_name',
				default: 'video',
				useVariables: true,
			},
			{
				type: 'textinput',
				label: 'Speed (int)',
				id: 'int',
				default: 0,
				max: 4,
				min: -4,
				regex: /^[-+]?\d+$|^\$\(.+\)$/,
				useVariables: true,
			},
		],
		callback: async (event) => {
			const base_address = await this.parseVariablesInString(event.options.base_address)
			const layer = await this.parseVariablesInString(event.options.layer_name)
			const path = `${base_address}${layer}/speed`
			const int = await this.parseVariablesInString(event.options.int)
			sendNumericOsc(path, int, parseOscInteger, 'f')
		},
	}
	actions['layer_mode'] = {
		name: 'Layer mode',
		options: [
			{
				type: 'textinput',
				label: 'Base address:',
				id: 'base_address',
				default: layer_base_address,
				useVariables: true,
			},
			{
				type: 'textinput',
				label: 'Layer name:',
				id: 'layer_name',
				default: 'video',
				useVariables: true,
			},
			{
				type: 'dropdown',
				id: 'int',
				label: 'Mode:',
				default: '1',
				choices: choices.MODE,
			},
		],
		callback: async (event) => {
			const base_address = await this.parseVariablesInString(event.options.base_address)
			const layer = await this.parseVariablesInString(event.options.layer_name)
			const path = `${base_address}${layer}/mode`
			const int = await this.parseVariablesInString(event.options.int)
			sendNumericOsc(path, int, parseOscInteger, 'i')
		},
	}
	actions['layer_at_end_point'] = {
		name: 'Layer at end point',
		options: [
			{
				type: 'textinput',
				label: 'Base address:',
				id: 'base_address',
				default: layer_base_address,
				useVariables: true,
			},
			{
				type: 'textinput',
				label: 'Layer name:',
				id: 'layer_name',
				default: 'video',
				useVariables: true,
			},
			{
				type: 'dropdown',
				id: 'int',
				label: 'At end point:',
				default: '0',
				choices: choices.AT_END_POINT,
			},
		],
		callback: async (event) => {
			const base_address = await this.parseVariablesInString(event.options.base_address)
			const layer = await this.parseVariablesInString(event.options.layer_name)
			const path = `${base_address}${layer}/at_end_point`
			const int = await this.parseVariablesInString(event.options.int)
			sendNumericOsc(path, int, parseOscInteger, 'i')
		},
	}
	actions['layer_transition_time'] = {
		name: 'Layer transition time',
		options: [
			{
				type: 'textinput',
				label: 'Base address:',
				id: 'base_address',
				default: layer_base_address,
				useVariables: true,
			},
			{
				type: 'textinput',
				label: 'Layer name:',
				id: 'layer_name',
				default: 'video',
				useVariables: true,
			},
			{
				type: 'textinput',
				label: 'Transition time (int):',
				id: 'int',
				default: 0,
				max: 10,
				min: 0,
				regex: /^[-+]?\d+$|^\$\(.+\)$/,
				useVariables: true,
			},
		],
		callback: async (event) => {
			const base_address = await this.parseVariablesInString(event.options.base_address)
			const layer = await this.parseVariablesInString(event.options.layer_name)
			const path = `${base_address}${layer}/transition_time`
			const int = await this.parseVariablesInString(event.options.int)
			sendNumericOsc(path, int, parseOscInteger, 'i')
		},
	}
	actions['layer_volume'] = {
		name: 'Layer volume',
		options: [
			{
				type: 'textinput',
				label: 'Base address:',
				id: 'base_address',
				default: layer_base_address,
				useVariables: true,
			},
			{
				type: 'textinput',
				label: 'Layer name:',
				id: 'layer_name',
				default: 'video',
				useVariables: true,
			},
			{
				type: 'textinput',
				label: 'Volume (float):',
				id: 'float',
				default: 1,
				max: 1,
				min: 0,
				step: 0.01,
				regex: /^[-+]?\d*\.?\d+(e[-+]?\d+)?$|^\$\(.+\)$/,
				useVariables: true,
			},
		],
		callback: async (event) => {
			const base_address = await this.parseVariablesInString(event.options.base_address)
			const layer = await this.parseVariablesInString(event.options.layer_name)
			const path = `${base_address}${layer}/volume`
			const float = await this.parseVariablesInString(event.options.float)
			sendNumericOsc(path, float, parseOscFloat, 'f')
		},
	}
	actions['layer_brightness_shift'] = {
		name: 'Layer brightness (shift)',
		options: [
			{
				type: 'textinput',
				label: 'Base address:',
				id: 'base_address',
				default: layer_base_address,
				useVariables: true,
			},
			{
				type: 'textinput',
				label: 'Layer name:',
				id: 'layer_name',
				default: 'video',
				useVariables: true,
			},
			{
				type: 'textinput',
				label: 'Brightness (shift) (float):',
				id: 'float',
				default: 0,
				max: 1,
				min: -1,
				step: 0.01,
				regex: /^[-+]?\d*\.?\d+(e[-+]?\d+)?$|^\$\(.+\)$/,
				useVariables: true,
			},
		],
		callback: async (event) => {
			const base_address = await this.parseVariablesInString(event.options.base_address)
			const layer = await this.parseVariablesInString(event.options.layer_name)
			const path = `${base_address}${layer}/brightness_(shift)`
			const float = await this.parseVariablesInString(event.options.float)
			sendNumericOsc(path, float, parseOscFloat, 'f')
		},
	}
	actions['layer_contrast_scale'] = {
		name: 'Layer contrast scale',
		options: [
			{
				type: 'textinput',
				label: 'Base address:',
				id: 'base_address',
				default: layer_base_address,
				useVariables: true,
			},
			{
				type: 'textinput',
				label: 'Layer name:',
				id: 'layer_name',
				default: 'video',
				useVariables: true,
			},
			{
				type: 'textinput',
				label: 'Contrast scale (float):',
				id: 'float',
				default: 1,
				max: 2,
				min: 0,
				step: 0.01,
				regex: /^[-+]?\d*\.?\d+(e[-+]?\d+)?$|^\$\(.+\)$/,
				useVariables: true,
			},
		],
		callback: async (event) => {
			const base_address = await this.parseVariablesInString(event.options.base_address)
			const layer = await this.parseVariablesInString(event.options.layer_name)
			const path = `${base_address}${layer}/contrast_(scale)`
			const float = await this.parseVariablesInString(event.options.float)
			sendNumericOsc(path, float, parseOscFloat, 'f')
		},
	}
	actions['layer_saturation_scale'] = {
		name: 'Layer saturation scale',
		options: [
			{
				type: 'textinput',
				label: 'Base address:',
				id: 'base_address',
				default: layer_base_address,
				useVariables: true,
			},
			{
				type: 'textinput',
				label: 'Layer name:',
				id: 'layer_name',
				default: 'video',
				useVariables: true,
			},
			{
				type: 'textinput',
				label: 'Saturation scale (float):',
				id: 'float',
				default: 1,
				max: 4,
				min: 0,
				step: 0.01,
				regex: /^[-+]?\d*\.?\d+(e[-+]?\d+)?$|^\$\(.+\)$/,
				useVariables: true,
			},
		],
		callback: async (event) => {
			const base_address = await this.parseVariablesInString(event.options.base_address)
			const layer = await this.parseVariablesInString(event.options.layer_name)
			const path = `${base_address}${layer}/saturation_scale`
			const float = await this.parseVariablesInString(event.options.float)
			sendNumericOsc(path, float, parseOscFloat, 'f')
		},
	}
	// user-defined custom OSC action
	actions['custom_osc'] = {
		name: 'Send custom OSC message',
		options: [
			{
				type: 'textinput',
				label: 'OSC Path',
				id: 'osc_path',
				default: '/d3/custom/path',
				useVariables: true,
				regex: /^\/.+/, // must start with '/'
				tooltip: 'OSC path, e.g. /d3/custom/path. Supports variables.',
			},
			{
				type: 'dropdown',
				label: 'Argument Type',
				id: 'arg_type',
				default: 'string',
				choices: [
					{ id: 'string', label: 'String' },
					{ id: 'int', label: 'Integer' },
					{ id: 'float', label: 'Float' },
				],
			},
			{
				type: 'textinput',
				label: 'Argument Value',
				id: 'arg_value',
				default: '',
				useVariables: true,
				regex: /.*/, // backend validation only
				tooltip: 'Value to send. Supports variables.',
			},
		],
		callback: async (action, context) => {
			// Resolve variables
			let path = action.options.osc_path
			let value = action.options.arg_value
			if (context && context.parseVariablesInString) {
				path = await context.parseVariablesInString(path)
				value = await context.parseVariablesInString(value)
			}
			// Validate path
			if (!/^\/.+/.test(path)) {
				this.log('error', '[custom_osc] Invalid OSC path: ' + path)
				return
			}
			// Type conversion
			let argType = action.options.arg_type
			let oscArg = { type: 's', value: value }
			if (argType === 'int') {
				const intVal = parseOscInteger(value)
				if (isNaN(intVal)) {
					this.log('error', '[custom_osc] Argument is not a valid integer: ' + value)
					return
				}
				oscArg = { type: 'i', value: intVal }
			} else if (argType === 'float') {
				const floatVal = parseOscFloat(value)
				if (isNaN(floatVal)) {
					this.log('error', '[custom_osc] Argument is not a valid float: ' + value)
					return
				}
				oscArg = { type: 'f', value: floatVal }
			}
			// Send OSC message
			this.sendOscMessage(path, [oscArg])
		},
	}
	this.setActionDefinitions(actions)
}
