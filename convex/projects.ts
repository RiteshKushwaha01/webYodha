import { v } from 'convex/values'

import { mutation, query } from './_generated/server'

export const create = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()

    if (!identity) {
      throw new Error('Unauthorized')
    }

    await ctx.db.insert('projects', {
      name: args.name,
      ownerId: identity.subject,
    })
    // const projectId = await ctx.db.insert('projects', {
    //   name: args.name,
    //   ownerId: identity.subject,
    //   // updatedAt: Date.now(),
    // })

    // return projectId
  },
})

export const get = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    // return await ctx.db.query('projects').collect()
    // const identity = await verifyAuth(ctx)

    if (!identity) {
      return []
    }

    return await ctx.db
      .query('projects')
      .withIndex('by_owner', (q) => q.eq('ownerId', identity.subject))
      // .order('desc')
      .collect()
  },
})
