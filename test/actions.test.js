/* eslint n/no-unsupported-features/node-builtins: ["error", { version: ">=20.0.0" }] */
const assert = require('node:assert/strict')
const { test } = require('node:test')
const { initActions } = require('../src/actions')
const utils = require('../src/utils')

function createActions(variables = {}, parseVariablesInString = async (text) => text) {
	const messages = []
	const logs = []
	const feedbackChecks = []
	let definitions
	initActions.call({
		setActionDefinitions: (actions) => {
			definitions = actions
		},
		sendOscMessage: (path, args) => messages.push({ path, args }),
		log: (level, message) => logs.push({ level, message }),
		getVariableValue: (id) => variables[id],
		checkFeedbacks: (...ids) => feedbackChecks.push(ids),
		parseVariablesInString,
	})
	return { actions: definitions, cue: definitions.cue, messages, logs, feedbackChecks }
}

test('Cue sends 1 to 3 parts as separate OSC integers', async () => {
	const { cue, messages } = createActions()
	const cases = [
		[1, [1]],
		['5', [5]],
		['0', [0]],
		['1.2', [1, 2]],
		['1.2.5', [1, 2, 5]],
		['1.0.0', [1, 0, 0]],
		[' 001.02.005 ', [1, 2, 5]],
		['2147483647.0.2147483647', [2147483647, 0, 2147483647]],
	]
	for (const [input, values] of cases) {
		await cue.callback({ options: { int: input } })
		assert.deepEqual(messages.at(-1), {
			path: '/d3/showcontrol/cue',
			args: values.map((value) => ({ type: 'i', value })),
		})
	}
	assert.equal(messages.length, cases.length)
})

test('Cue resolves variables before it splits the parts', async () => {
	const { cue, messages } = createActions()
	await cue.callback(
		{ options: { int: '$(internal:cue_number)' } },
		{
			parseVariablesInString: async (input) => {
				assert.equal(input, '$(internal:cue_number)')
				return '1.2.5'
			},
		},
	)
	assert.deepEqual(messages, [
		{
			path: '/d3/showcontrol/cue',
			args: [
				{ type: 'i', value: 1 },
				{ type: 'i', value: 2 },
				{ type: 'i', value: 5 },
			],
		},
	])
})

test('Cue rejects invalid parts, extra parts, and integers outside the OSC range', async () => {
	const { cue, messages, logs } = createActions()
	const invalidCues = [
		'',
		' ',
		'.1',
		'1.',
		'1..2',
		'1.2.3.4',
		'1.2x',
		'1.2.5foo',
		'1,2,5',
		'1 2 5',
		'1e2',
		'NaN',
		'Infinity',
		'-1',
		'+1',
		'-0',
		'1.-2',
		'1.+2',
		'1.2.-5',
		'1.2.+5',
		'2147483648',
		'1.-2147483649',
		'1.2.999999999999999999999',
		undefined,
		null,
	]
	for (const input of invalidCues) {
		await cue.callback({ options: { int: input } })
	}
	assert.deepEqual(messages, [])
	assert.equal(logs.filter(({ level }) => level === 'error').length, invalidCues.length)
})

test('Cue rejects an invalid value from a variable', async () => {
	const { cue, messages, logs } = createActions()
	const invalidCues = ['1.2.3.4', '-1', '+1', '1.-2', '1.+2', '1.2.-5', '1.2.+5']
	for (const value of invalidCues) {
		await cue.callback({ options: { int: '$(internal:cue_number)' } }, { parseVariablesInString: async () => value })
	}
	assert.deepEqual(messages, [])
	assert.equal(logs.filter(({ level }) => level === 'error').length, invalidCues.length)
})

test('Cue input accepts multipart numbers and variables', () => {
	const { cue } = createActions()
	const { regex } = cue.options.find(({ id }) => id === 'int')
	for (const value of ['0', '1', '1.2', '1.2.5', '$(internal:cue_number)']) {
		assert.ok(regex.test(value), value)
	}
	for (const value of ['', '-1', '+1', '-0', '1.-2', '1.+2', '1.2.-5', '1.2.+5', '1.', '1..2', '1.2.3.4', '1.2x']) {
		assert.ok(!regex.test(value), value)
	}
})

// https://help.disguise.one/designer/timeline-tracks-transports/osc/controlling
for (const [id, address] of [
	['play', '/d3/showcontrol/play'],
	['playsection', '/d3/showcontrol/playsection'],
	['loopsection', '/d3/showcontrol/loop'],
	['stop', '/d3/showcontrol/stop'],
	['previoussection', '/d3/showcontrol/previoussection'],
	['nextsection', '/d3/showcontrol/nextsection'],
	['returntostart', '/d3/showcontrol/returntostart'],
	['previoustrack', '/d3/showcontrol/previoustrack'],
	['nexttrack', '/d3/showcontrol/nexttrack'],
	['fadeup', '/d3/showcontrol/fadeup'],
	['fadedown', '/d3/showcontrol/fadedown'],
	['hold', '/d3/showcontrol/hold'],
]) {
	test(`${id} sends the documented address with no arguments`, async () => {
		const { actions, messages } = createActions()
		await actions[id].callback()
		assert.deepEqual(messages, [{ path: address, args: [] }])
	})
}

test('Track name sends one OSC string', async () => {
	const { actions, messages } = createActions()
	await actions.trackname.callback({ options: { string: 'Opening track' } })
	assert.deepEqual(messages, [{ path: '/d3/showcontrol/trackname', args: [{ type: 's', value: 'Opening track' }] }])
})

test('Track name resolves variables before sending', async () => {
	const { actions, messages } = createActions()
	await actions.trackname.callback(
		{ options: { string: '$(internal:track)' } },
		{
			parseVariablesInString: async (text) => {
				assert.equal(text, '$(internal:track)')
				return 'Opening track'
			},
		},
	)
	assert.deepEqual(messages, [{ path: '/d3/showcontrol/trackname', args: [{ type: 's', value: 'Opening track' }] }])
})

test('Toggle shift changes direction and checks feedback without throwing', (t) => {
	const previousShift = utils.shift
	t.after(() => {
		utils.shift = previousShift
	})
	utils.shift = false
	const { actions, feedbackChecks } = createActions()
	actions.shift.callback()
	assert.equal(utils.shift, true)
	assert.deepEqual(feedbackChecks, [[]])
})

// https://help.disguise.one/designer/timeline-tracks-transports/osc/triggering-cues-with-osc
for (const [id, option, input, type, value] of [
	['trackid', 'int', '42', 'i', 42],
	['floatcue', 'float', '1.10', 'f', 1.1],
	['floatcue', 'float', '1.01', 'f', 1.01],
]) {
	for (const resolveVariables of [false, true]) {
		test(`${id} sends ${input} as one ${type} argument (variables: ${resolveVariables})`, async () => {
			const { actions, messages } = createActions()
			const context = resolveVariables
				? {
						parseVariablesInString: async (text) => {
							assert.equal(text, '$(internal:value)')
							return input
						},
					}
				: undefined
			await actions[id].callback({ options: { [option]: resolveVariables ? '$(internal:value)' : input } }, context)
			assert.deepEqual(messages, [{ path: `/d3/showcontrol/${id}`, args: [{ type, value }] }])
		})
	}
}

for (const [id, option] of [
	['trackid', 'int'],
	['floatcue', 'float'],
]) {
	test(`${id} does not send a nonnumeric value`, async () => {
		const { actions, messages } = createActions()
		await actions[id].callback({ options: { [option]: 'invalid' } })
		await actions[id].callback(
			{ options: { [option]: '$(internal:value)' } },
			{ parseVariablesInString: async () => 'invalid' },
		)
		assert.deepEqual(messages, [])
	})
}

const invalidNumericInputs = [
	'',
	' ',
	'12junk',
	'1 2',
	'1\n2',
	'0x10',
	'0b10',
	'NaN',
	'Infinity',
	'-Infinity',
	NaN,
	Infinity,
	null,
	undefined,
	true,
	['12'],
	{},
]
const invalidIntegerInputs = [
	...invalidNumericInputs,
	'1.5',
	'1e2',
	'2147483648',
	'-2147483649',
	'999999999999999999999',
]
const invalidFloatInputs = [...invalidNumericInputs, '1.2.3', '1e', '1e309', '1e39', '-1e39', 1e39]

for (const [id, option, type, path] of [
	['trackid', 'int', 'i', '/d3/showcontrol/trackid'],
	['floatcue', 'float', 'f', '/d3/showcontrol/floatcue'],
	['custom_osc', 'arg_value', 'i', '/d3/custom'],
	['custom_osc', 'arg_value', 'f', '/d3/custom'],
]) {
	async function invoke(actions, value, resolveVariables) {
		const options = { [option]: resolveVariables ? '$(internal:value)' : value }
		if (id === 'custom_osc') {
			options.osc_path = path
			options.arg_type = type === 'i' ? 'int' : 'float'
		}
		await actions[id].callback(
			{ options },
			resolveVariables
				? { parseVariablesInString: async (text) => (text === '$(internal:value)' ? value : text) }
				: undefined,
		)
	}

	test(`${id} rejects malformed and out-of-range OSC ${type} values`, async () => {
		const { actions, messages } = createActions()
		for (const resolveVariables of [false, true]) {
			for (const value of type === 'i' ? invalidIntegerInputs : invalidFloatInputs) {
				await invoke(actions, value, resolveVariables)
				assert.deepEqual(messages, [], `input=${String(value)}, variables=${resolveVariables}`)
			}
		}
	})

	test(`${id} preserves valid OSC ${type} values and boundaries`, async () => {
		const { actions, messages } = createActions()
		const cases =
			type === 'i'
				? [
						[0, 0],
						['+42', 42],
						['-42', -42],
						[' 0012 ', 12],
						['2147483647', 2147483647],
						['-2147483648', -2147483648],
					]
				: [
						[0, 0],
						[1.25, 1.25],
						['+1.25', 1.25],
						['-.5', -0.5],
						[' 1. ', 1],
						['1.2e-3', 0.0012],
						['2.5E+2', 250],
						['3.4028235e38', 3.4028235e38],
						['-3.4028235e38', -3.4028235e38],
					]
		for (const resolveVariables of [false, true]) {
			for (const [input, value] of cases) {
				await invoke(actions, input, resolveVariables)
				assert.deepEqual(
					messages.at(-1),
					{ path, args: [{ type, value }] },
					`input=${input}, variables=${resolveVariables}`,
				)
			}
		}
		assert.equal(messages.length, cases.length * 2)
	})
}

for (const level of ['brightness', 'volume']) {
	for (const direction of ['increment', 'decrement', 'shift']) {
		const id = `${direction}_${level}`
		test(`${id} rejects invalid steps`, async () => {
			const { actions, messages, logs } = createActions({ [level]: '0.50' })
			for (const resolveVariables of [false, true]) {
				for (const input of invalidFloatInputs) {
					await actions[id].callback(
						{ options: { float: resolveVariables ? '$(internal:step)' : input } },
						resolveVariables ? { parseVariablesInString: async () => input } : undefined,
					)
					assert.deepEqual(messages, [], `step=${String(input)}, variables=${resolveVariables}`)
				}
			}
			assert.equal(logs.filter(({ level }) => level === 'error').length, invalidFloatInputs.length * 2)
		})

		test(`${id} rejects invalid current levels`, async () => {
			const variables = {}
			const { actions, messages } = createActions(variables)
			for (const input of invalidFloatInputs) {
				variables[level] = input
				await actions[id].callback({ options: { float: '0.10' } })
				assert.deepEqual(messages, [], `current level=${String(input)}`)
			}
		})

		test(`${id} accepts a zero step and resolves a decimal step from a variable`, async (t) => {
			const previousShift = utils.shift
			t.after(() => {
				utils.shift = previousShift
			})
			utils.shift = false
			const { actions, messages } = createActions({ [level]: '0.50' })
			await actions[id].callback({ options: { float: 0 } })
			await actions[id].callback(
				{ options: { float: '$(internal:step)' } },
				{ parseVariablesInString: async () => '1e-1' },
			)
			assert.deepEqual(messages, [
				{ path: `/d3/showcontrol/${level}`, args: [{ type: 'f', value: 0.5 }] },
				{ path: `/d3/showcontrol/${level}`, args: [{ type: 'f', value: direction === 'decrement' ? 0.4 : 0.6 }] },
			])
		})
	}

	for (const [direction, current, step, expected] of [
		['increment', '0.50', '0.10', 0.6],
		['decrement', '0.50', '0.10', 0.4],
		['increment', '0.99', '0.10', 1],
		['decrement', '0.01', '0.10', 0],
	]) {
		test(`${direction} ${level} from ${current} stays within the documented range`, async () => {
			const { actions, messages } = createActions({ [level]: current })
			await actions[`${direction}_${level}`].callback({ options: { float: step } })
			assert.deepEqual(messages, [{ path: `/d3/showcontrol/${level}`, args: [{ type: 'f', value: expected }] }])
		})
	}
	for (const shift of [false, true]) {
		test(`Shift ${level} resolves the step and uses shift=${shift}`, async (t) => {
			const previousShift = utils.shift
			t.after(() => {
				utils.shift = previousShift
			})
			utils.shift = shift
			const { actions, messages } = createActions({ [level]: '0.50' })
			await actions[`shift_${level}`].callback(
				{ options: { float: '$(internal:step)' } },
				{
					parseVariablesInString: async (text) => {
						assert.equal(text, '$(internal:step)')
						return '0.10'
					},
				},
			)
			assert.deepEqual(messages, [
				{ path: `/d3/showcontrol/${level}`, args: [{ type: 'f', value: shift ? 0.4 : 0.6 }] },
			])
		})
	}
}

test('Level actions reject calculated values outside the OSC float range', async (t) => {
	const previousShift = utils.shift
	t.after(() => {
		utils.shift = previousShift
	})
	utils.shift = false
	for (const level of ['brightness', 'volume']) {
		for (const direction of ['increment', 'decrement', 'shift']) {
			const current = direction === 'decrement' ? '3.4028235e38' : '-3.4028235e38'
			const { actions, messages } = createActions({ [level]: current })
			await actions[`${direction}_${level}`].callback({ options: { float: '-3.4028235e38' } })
			assert.deepEqual(messages, [], `${direction}_${level}`)
		}
	}
})

for (const [id, option, inputType, suffix, input, expected] of [
	['layer_blendmode', 'mode', 'i', 'blendmode', '00', 0],
	['layer_brightness', 'float', 'f', 'brightness', '2.5e-1', 0.25],
	['layer_tint', 'float', 'f', 'tint.g', '0.25', 0.25],
	['layer_speed', 'int', 'i', 'speed', '-2', -2],
	['layer_mode', 'int', 'i', 'mode', '1', 1],
	['layer_at_end_point', 'int', 'i', 'at_end_point', '0', 0],
	['layer_transition_time', 'int', 'i', 'transition_time', '2', 2],
	['layer_volume', 'float', 'f', 'volume', '7.5e-1', 0.75],
	['layer_brightness_shift', 'float', 'f', 'brightness_(shift)', '-.25', -0.25],
	['layer_contrast_scale', 'float', 'f', 'contrast_(scale)', '1.5', 1.5],
	['layer_saturation_scale', 'float', 'f', 'saturation_scale', '2.5', 2.5],
]) {
	const options = { base_address: '/d3/layer/', layer_name: 'video', channel: 'g' }

	test(`${id} rejects invalid numeric inputs before sending`, async () => {
		const invalidInputs = inputType === 'i' ? invalidIntegerInputs : invalidFloatInputs
		for (const resolveVariables of [false, true]) {
			for (const input of invalidInputs) {
				const { actions, messages, logs } = createActions({}, async (text) =>
					text === '$(internal:value)' ? input : text,
				)
				await actions[id].callback({
					options: { ...options, [option]: resolveVariables ? '$(internal:value)' : input },
				})
				assert.deepEqual(messages, [], `input=${String(input)}, variables=${resolveVariables}`)
				assert.equal(logs.filter(({ level }) => level === 'error').length, 1)
			}
		}
	})

	test(`${id} preserves its OSC address and argument type for valid input`, async () => {
		const { actions, messages } = createActions({}, async (text) => (text === '$(internal:value)' ? input : text))
		for (const value of [input, '$(internal:value)']) {
			await actions[id].callback({ options: { ...options, [option]: value } })
		}
		const message = {
			path: `/d3/layer/video/${suffix}`,
			args: [{ type: id === 'layer_speed' ? 'f' : inputType, value: expected }],
		}
		assert.deepEqual(messages, [message, message])
	})
}

for (const [argType, input, type, value] of [
	['string', 'Fade up', 's', 'Fade up'],
	['int', '0', 'i', 0],
	['float', '0.25', 'f', 0.25],
]) {
	test(`Custom OSC sends a resolved path and ${argType} value`, async () => {
		const { actions, messages } = createActions()
		await actions.custom_osc.callback(
			{ options: { osc_path: '$(internal:path)', arg_type: argType, arg_value: '$(internal:value)' } },
			{
				parseVariablesInString: async (text) => {
					assert.ok(['$(internal:path)', '$(internal:value)'].includes(text))
					return text === '$(internal:path)' ? '/d3/custom/status' : input
				},
			},
		)
		assert.deepEqual(messages, [{ path: '/d3/custom/status', args: [{ type, value }] }])
	})
}

for (const [path, argType, value] of [
	['d3/status', 'string', 'Fade up'],
	['/', 'string', 'Fade up'],
	['', 'string', 'Fade up'],
	['/d3/status', 'int', 'invalid'],
	['/d3/status', 'float', 'invalid'],
]) {
	test(`Custom OSC rejects path=${JSON.stringify(path)}, type=${argType}, value=${value}`, async () => {
		const { actions, messages, logs } = createActions()
		await actions.custom_osc.callback({ options: { osc_path: path, arg_type: argType, arg_value: value } })
		assert.deepEqual(messages, [])
		assert.equal(logs.filter(({ level }) => level === 'error').length, 1)
	})
}
