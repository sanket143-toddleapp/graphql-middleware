import { GraphQLSchema } from 'graphql'
import { addResolversToSchema } from '@graphql-tools/schema'
import {
  IApplyOptions,
  IMiddleware,
  FragmentReplacement,
  IMiddlewareGenerator,
  GraphQLSchemaWithFragmentReplacements,
} from './types'
import { generateResolverFromSchemaAndMiddleware } from './applicator'
import { validateMiddleware } from './validation'
import { extractFragmentReplacements } from './fragments'
import { isMiddlewareGenerator } from './utils'

/**
 *
 * @param schema
 * @param options
 * @param middleware
 *
 * Validates middleware and generates resolvers map for provided middleware.
 * Applies middleware to the current schema and returns the modified one.
 *
 */
export function addMiddlewareToSchema<TSource, TContext, TArgs>(
  schema: GraphQLSchema,
  options: IApplyOptions,
  middleware: IMiddleware<TSource, TContext, TArgs>,
): {
  schema: GraphQLSchema
  fragmentReplacements: FragmentReplacement[]
} {
  const validMiddleware = validateMiddleware(schema, middleware)
  const resolvers = generateResolverFromSchemaAndMiddleware(
    schema,
    options,
    validMiddleware,
  )

  const fragmentReplacements = extractFragmentReplacements(resolvers)

  const newSchema = addResolversToSchema({
    schema,
    resolvers,
    updateResolversInPlace: false,
    resolverValidationOptions: {
      requireResolversForResolveType: 'ignore',
    },
  })

  return { schema: newSchema, fragmentReplacements }
}

/**
 *
 * @param schema
 * @param options
 * @param middlewares
 *
 * Generates middleware from middleware generators and applies middleware to
 * resolvers. Returns generated schema with all provided middleware.
 *
 */
function applyMiddlewareWithOptions<TSource = any, TContext = any, TArgs = any>(
  schema: GraphQLSchema,
  options: IApplyOptions,
  ...middlewares: (
    | IMiddleware<TSource, TContext, TArgs>
    | IMiddlewareGenerator<TSource, TContext, TArgs>
  )[]
): GraphQLSchemaWithFragmentReplacements {
  console.time('GM: normalisedMiddlewares')
  console.log('middlewares', middlewares)
  const normalisedMiddlewares = middlewares.map((middleware) => {
    if (isMiddlewareGenerator(middleware)) {
      return middleware.generate(schema)
    } else {
      return middleware
    }
  })
  console.timeEnd('GM: normalisedMiddlewares')

  console.time('GM: schemaWithMiddlewareAndFragmentReplacements')
  const schemaWithMiddlewareAndFragmentReplacements =
    normalisedMiddlewares.reduceRight(
      (
        {
          schema: currentSchema,
          fragmentReplacements: currentFragmentReplacements,
        },
        middleware,
      ) => {
        const {
          schema: newSchema,
          fragmentReplacements: newFragmentReplacements,
        } = addMiddlewareToSchema(currentSchema, options, middleware)

        return {
          schema: newSchema,
          fragmentReplacements: [
            ...currentFragmentReplacements,
            ...newFragmentReplacements,
          ],
        }
      },
      { schema, fragmentReplacements: [] },
    )
  console.timeEnd('GM: schemaWithMiddlewareAndFragmentReplacements')

  const schemaWithMiddleware: GraphQLSchemaWithFragmentReplacements =
    schemaWithMiddlewareAndFragmentReplacements.schema

  schemaWithMiddleware.schema =
    schemaWithMiddlewareAndFragmentReplacements.schema
  schemaWithMiddleware.fragmentReplacements =
    schemaWithMiddlewareAndFragmentReplacements.fragmentReplacements

  return schemaWithMiddleware
}

// Exposed functions

/**
 *
 * @param schema
 * @param middlewares
 *
 * Apply middleware to resolvers and return generated schema.
 *
 */
export function applyMiddleware<TSource = any, TContext = any, TArgs = any>(
  schema: GraphQLSchema,
  ...middlewares: (
    | IMiddleware<TSource, TContext, TArgs>
    | IMiddlewareGenerator<TSource, TContext, TArgs>
  )[]
): GraphQLSchemaWithFragmentReplacements {
  return applyMiddlewareWithOptions(
    schema,
    { onlyDeclaredResolvers: false },
    ...middlewares,
  )
}

/**
 *
 * @param schema
 * @param middlewares
 *
 * Apply middleware to declared resolvers and return new schema.
 *
 */
export function applyMiddlewareToDeclaredResolvers<
  TSource = any,
  TContext = any,
  TArgs = any,
>(
  schema: GraphQLSchema,
  ...middlewares: (
    | IMiddleware<TSource, TContext, TArgs>
    | IMiddlewareGenerator<TSource, TContext, TArgs>
  )[]
): GraphQLSchemaWithFragmentReplacements {
  console.log('GM: applyMiddlewareToDeclaredResolvers')
  console.time('applyMiddlewareWithOptions')
  const result = applyMiddlewareWithOptions(
    schema,
    { onlyDeclaredResolvers: true },
    ...middlewares,
  )
  console.timeEnd('applyMiddlewareWithOptions')

  return result
}
