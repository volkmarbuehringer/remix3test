import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'

import {
  envBool,
  envPositiveNumber,
  envPositiveNumberOrUndefined,
  envString,
  isTest,
  requireEnv,
} from './config.ts'

function throws(fn: () => unknown): boolean {
  try {
    fn()
    return false
  } catch {
    return true
  }
}

describe('config env helpers', () => {
  let saved: Record<string, string | undefined> = {}

  function set(name: string, value: string | undefined) {
    if (!(name in saved)) saved[name] = process.env[name]
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }

  afterEach(() => {
    for (let [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
    saved = {}
  })

  it('resolves NODE_ENV=test for the test process', () => {
    assert.equal(isTest, true)
  })

  it('envString trims and treats blank as undefined', () => {
    set('CFG_STR', '  value  ')
    assert.equal(envString('CFG_STR'), 'value')
    set('CFG_STR', '   ')
    assert.equal(envString('CFG_STR'), undefined)
  })

  it('envPositiveNumber keeps positives and falls back for zero/invalid/unset', () => {
    set('CFG_NUM', '5')
    assert.equal(envPositiveNumber('CFG_NUM', 9), 5)
    set('CFG_NUM', '0')
    assert.equal(envPositiveNumber('CFG_NUM', 9), 9)
    set('CFG_NUM', 'abc')
    assert.equal(envPositiveNumber('CFG_NUM', 9), 9)
    set('CFG_NUM', undefined)
    assert.equal(envPositiveNumber('CFG_NUM', 9), 9)
  })

  it('envPositiveNumberOrUndefined returns undefined instead of a fallback', () => {
    set('CFG_NUM2', '7')
    assert.equal(envPositiveNumberOrUndefined('CFG_NUM2'), 7)
    set('CFG_NUM2', '0')
    assert.equal(envPositiveNumberOrUndefined('CFG_NUM2'), undefined)
  })

  it('envBool accepts common truthy spellings', () => {
    set('CFG_BOOL', 'true')
    assert.equal(envBool('CFG_BOOL'), true)
    set('CFG_BOOL', '0')
    assert.equal(envBool('CFG_BOOL'), false)
    set('CFG_BOOL', undefined)
    assert.equal(envBool('CFG_BOOL', true), true)
  })

  it('requireEnv throws a named error when unset', () => {
    set('CFG_REQ', undefined)
    assert.ok(
      throws(() => requireEnv('CFG_REQ')),
      'should throw when unset',
    )
  })
})
