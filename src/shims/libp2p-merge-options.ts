import isOptionObject from 'is-plain-obj';

const { hasOwnProperty } = Object.prototype;
const { propertyIsEnumerable } = Object;
const rootThis = globalThis;

const defaultMergeOptions = {
  concatArrays: false,
  ignoreUndefined: false
};

const defineProperty = (object: object, name: PropertyKey, value: unknown): void => {
  Object.defineProperty(object, name, {
    value,
    writable: true,
    enumerable: true,
    configurable: true
  });
};

const getEnumerableOwnPropertyKeys = (value: object): PropertyKey[] => {
  const keys: PropertyKey[] = [];

  for (const key in value) {
    if (hasOwnProperty.call(value, key)) {
      keys.push(key);
    }
  }

  if (Object.getOwnPropertySymbols != null) {
    for (const symbol of Object.getOwnPropertySymbols(value)) {
      if (propertyIsEnumerable.call(value, symbol)) {
        keys.push(symbol);
      }
    }
  }

  return keys;
};

function clone<T>(value: T): T {
  if (Array.isArray(value)) {
    return cloneArray(value) as T;
  }

  if (isOptionObject(value)) {
    return cloneOptionObject(value) as T;
  }

  return value;
}

function cloneArray(array: unknown[]): unknown[] {
  const result = array.slice(0, 0);

  getEnumerableOwnPropertyKeys(array).forEach((key) => {
    defineProperty(result, key, clone(array[key as keyof typeof array]));
  });

  return result;
}

function cloneOptionObject(object: Record<PropertyKey, unknown>): Record<PropertyKey, unknown> {
  const result =
    Object.getPrototypeOf(object) === null
      ? Object.create(null)
      : {};

  getEnumerableOwnPropertyKeys(object).forEach((key) => {
    defineProperty(result, key, clone(object[key]));
  });

  return result;
}

const mergeKeys = (
  merged: Record<PropertyKey, unknown>,
  source: Record<PropertyKey, unknown>,
  keys: PropertyKey[],
  config: typeof defaultMergeOptions
): Record<PropertyKey, unknown> => {
  keys.forEach((key) => {
    if (typeof source[key] === 'undefined' && config.ignoreUndefined) {
      return;
    }

    if (key in merged && merged[key] !== Object.getPrototypeOf(merged)) {
      defineProperty(merged, key, merge(merged[key], source[key], config));
    } else {
      defineProperty(merged, key, clone(source[key]));
    }
  });

  return merged;
};

const concatArrays = (
  merged: unknown[],
  source: unknown[],
  config: typeof defaultMergeOptions
): unknown[] => {
  let result = merged.slice(0, 0);
  let resultIndex = 0;

  [merged, source].forEach((array) => {
    const indices: string[] = [];

    for (let i = 0; i < array.length; i += 1) {
      if (!hasOwnProperty.call(array, i)) {
        continue;
      }

      indices.push(String(i));

      if (array === merged) {
        defineProperty(result, resultIndex++, array[i]);
      } else {
        defineProperty(result, resultIndex++, clone(array[i]));
      }
    }

    result = mergeKeys(
      result as Record<PropertyKey, unknown>,
      array as Record<PropertyKey, unknown>,
      getEnumerableOwnPropertyKeys(array).filter((key) => !indices.includes(String(key))),
      config
    ) as unknown[];
  });

  return result;
};

function merge(
  merged: unknown,
  source: unknown,
  config: typeof defaultMergeOptions
): unknown {
  if (config.concatArrays && Array.isArray(merged) && Array.isArray(source)) {
    return concatArrays(merged, source, config);
  }

  if (!isOptionObject(source) || !isOptionObject(merged)) {
    return clone(source);
  }

  return mergeKeys(
    merged as Record<PropertyKey, unknown>,
    source as Record<PropertyKey, unknown>,
    getEnumerableOwnPropertyKeys(source),
    config
  );
}

export function mergeOptions(...options: Array<Record<PropertyKey, unknown> | undefined>): Record<PropertyKey, unknown> {
  const config = merge(
    clone(defaultMergeOptions),
    ((this !== rootThis && this) || {}) as Record<PropertyKey, unknown>,
    defaultMergeOptions
  ) as typeof defaultMergeOptions;

  let merged: Record<PropertyKey, unknown> = { _: {} };

  for (const option of options) {
    if (option === undefined) {
      continue;
    }

    if (!isOptionObject(option)) {
      throw new TypeError(`\`${String(option)}\` is not an Option Object`);
    }

    merged = merge(merged, { _: option }, config) as Record<PropertyKey, unknown>;
  }

  return merged._ as Record<PropertyKey, unknown>;
}
