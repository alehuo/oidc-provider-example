/* eslint-disable no-unused-vars */
// Thanks to https://github.com/panva/node-oidc-provider-example/tree/master/03-oidc-views-accounts
import { Configuration, Provider } from 'oidc-provider'
import mysql from 'mysql2/promise'
import bcrypt from 'bcrypt'
import express, { RequestHandler } from 'express'
import path from 'path'
import session from 'express-session'
import bodyParser from 'body-parser'

const init = async () => {
  await new Promise(resolve => { // Fix for Docker mysql timeout
    setTimeout(resolve, 4000)
  })
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  })

  async function authenticate (email: string, password: string) {
    try {
      const lowercasedEmail = String(email).toLowerCase()
      const [rows, _fields] = await connection.query<mysql.RowDataPacket[]>('SELECT id, password FROM users WHERE email = ? LIMIT 1', [lowercasedEmail])
      if (rows.length !== 1) {
        return undefined
      }
      const user = rows[0]
      const res = bcrypt.compareSync(password, user.password)
      if (res === true) {
        return user.id
      }
      return undefined
    } catch (err) {
      return undefined
    }
  }

  const configuration: Configuration = {
    clients: [{
      client_id: 'foo',
      client_secret: 'bar',
      redirect_uris: ['http://openidconnect.net/callback']
    }],
    claims: {
      openid: ['sub'],
      email: ['email', 'email_verified']
    },
    cookies: {
      keys: ['example']
    },
    async findAccount (_ctx, sub, _token) {
      const [rows, _fields] = await connection.query<mysql.RowDataPacket[]>('SELECT id, email, email_verified, firstname, lastname FROM users WHERE email = ? LIMIT 1', [sub])
      if (rows.length !== 1) {
        return undefined
      }
      const user = rows[0]
      return {
        accountId: user.id,
        async claims () {
          return {
            sub: user.id,
            email: user.email,
            email_verified: user.email_verified,
            given_name: user.firstname,
            name: `${user.firstname} ${user.lastname}`
          }
        }
      }
    },
    interactions: {
      url (ctx) {
        return `/interaction/${ctx.oidc.uid}`
      }
    },
    features: {
      devInteractions: { enabled: false },
      introspection: { enabled: true },
      revocation: { enabled: true }
    }
  }

  const port = parseInt(process.env.PORT || '3000', 10)

  const oidc = new Provider(`http://localhost:${port}`, configuration)

  oidc.proxy = true
  oidc.keys = String(process.env.SECURE_KEY).split(',')

  const app = express()
  app.set('trust proxy', true)
  app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
  }))
  app.set('view engine', 'ejs')
  app.set('views', path.resolve(process.cwd(), 'views'))

  const parse = bodyParser.urlencoded({ extended: false })

  const setNoCache: RequestHandler = (_req, res, next) => {
    res.set('Pragma', 'no-cache')
    res.set('Cache-Control', 'no-cache, no-store')
    next()
  }

  app.get('/interaction/:uid', setNoCache, async (req, res, next) => {
    try {
      const details = await oidc.interactionDetails(req, res)
      // console.log('see what else is available to you for interaction views', details)
      const { uid, prompt, params } = details

      const client = await oidc.Client.find(params.client_id)

      if (prompt.name === 'login') {
        return res.render('login', {
          client,
          uid,
          details: prompt.details,
          params,
          title: 'Sign-in',
          flash: undefined
        })
      }

      return res.render('interaction', {
        client,
        uid,
        details: prompt.details,
        params,
        title: 'Authorize'
      })
    } catch (err) {
      return next(err)
    }
  })

  app.post('/interaction/:uid/login', setNoCache, parse, async (req, res, next) => {
    try {
      const { uid, prompt, params } = await oidc.interactionDetails(req, res)
      const client = await oidc.Client.find(params.client_id)

      const accountId = await authenticate(req.body.email, req.body.password)

      if (!accountId) {
        res.render('login', {
          client,
          uid,
          details: prompt.details,
          params: {
            ...params,
            login_hint: req.body.email
          },
          title: 'Sign-in',
          flash: 'Invalid email or password.'
        })
        return
      }

      const result = {
        login: {
          account: accountId
        }
      }

      await oidc.interactionFinished(req, res, result, { mergeWithLastSubmission: false })
    } catch (err) {
      next(err)
    }
  })

  app.post('/interaction/:uid/confirm', setNoCache, parse, async (req, res, next) => {
    try {
      const result = {
        consent: {
        // rejectedScopes: [], // < uncomment and add rejections here
        // rejectedClaims: [], // < uncomment and add rejections here
        }
      }
      await oidc.interactionFinished(req, res, result, { mergeWithLastSubmission: true })
    } catch (err) {
      next(err)
    }
  })

  app.get('/interaction/:uid/abort', setNoCache, async (req, res, next) => {
    try {
      const result = {
        error: 'access_denied',
        error_description: 'End-User aborted interaction'
      }
      await oidc.interactionFinished(req, res, result, { mergeWithLastSubmission: false })
    } catch (err) {
      next(err)
    }
  })

  // leave the rest of the requests to be handled by oidc-provider, there's a catch all 404 there
  app.use(oidc.callback)

  // express listen
  app.listen(port, () => {
    console.log(`oidc-provider listening on port ${port}, check http://localhost:${port}/.well-known/openid-configuration`)
  })
}

init().then(() => {
  console.log('OK')
}).catch(err => {
  console.error(err)
})
