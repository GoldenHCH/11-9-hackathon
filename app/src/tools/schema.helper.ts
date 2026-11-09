import type { IJsonSchema, IJsonSchemaProperty } from './tools.interfaces';
import type { JsonSchemaType } from './tools.types';

export class SchemaHelper {
  public static validate(schema: IJsonSchema, input: unknown): string | undefined {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return 'Send the tool input as a JSON object.';
    }

    const record = input as Record<string, unknown>;

    for (const requiredKey of schema.required) {
      if (record[requiredKey] === undefined || record[requiredKey] === null) {
        return `"${requiredKey}" is required.`;
      }
    }

    for (const [key, property] of Object.entries(schema.properties)) {
      const value = record[key];

      if (value !== undefined && value !== null) {
        const problem = SchemaHelper._validateProperty(key, property, value);

        if (problem) {
          return problem;
        }
      }
    }

    return undefined;
  }

  private static _validateProperty(key: string, property: IJsonSchemaProperty, value: unknown): string | undefined {
    if (!SchemaHelper._matchesType(property.type, value)) {
      return `"${key}" must be ${SchemaHelper._describeType(property.type)}.`;
    }

    if (property.type === 'string') {
      const text = value as string;

      if (text.trim() === '') {
        return `"${key}" must not be empty.`;
      }

      if (property.enum && !property.enum.includes(text)) {
        return `"${key}" must be one of: ${property.enum.join(', ')}.`;
      }

      if (property.pattern && !new RegExp(property.pattern).test(text)) {
        return `"${key}" has the wrong format.`;
      }
    }

    if (property.type === 'integer') {
      const number = value as number;

      if ((property.minimum !== undefined && number < property.minimum) || (property.maximum !== undefined && number > property.maximum)) {
        return `"${key}" must be a whole number between ${property.minimum ?? 'any'} and ${property.maximum ?? 'any'}.`;
      }
    }

    if (property.type === 'array' && property.items) {
      const itemType = property.items.type;
      const hasBadItem = (value as unknown[]).some((item) => !SchemaHelper._matchesType(itemType, item));

      if (hasBadItem) {
        return `"${key}" must only contain ${SchemaHelper._describeType(itemType)} values.`;
      }
    }

    return undefined;
  }

  private static _matchesType(type: JsonSchemaType, value: unknown): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'integer':
        return Number.isInteger(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
    }
  }

  private static _describeType(type: JsonSchemaType): string {
    switch (type) {
      case 'string':
        return 'text';
      case 'integer':
        return 'a whole number';
      case 'boolean':
        return 'true or false';
      case 'array':
        return 'a list';
    }
  }
}
