const express = require('express')
const bodyParser = require('body-parser')
const morgan = require('morgan')
const morganJson = require('morgan-json')
const log = require('winston')
const exec = require('child-process-promise').exec
const chdir = require('chdir')
const fs = require('fs')

log.cli()
log.level = process.env.LOG_LEVEL || 'info'

const puppetPath = '/code/environments'
const authToken = process.env.AUTH_TOKEN
const githubToken = process.env.GITHUB_TOKEN
const initialGitBranch = process.env.INITIAL_GIT_BRANCH || 'production'
const initialGitRepoUrl = process.env.INITIAL_GIT_REPO_URL

const gitConfig = function gitConfig(git) {
  return new Promise(
    (resolve, reject) => {
      log.info('Setting up Git Configuration')
      exec('git config --global credential.helper store')
        .then(() => { resolve(git) })
        .catch((err) => { reject(err) })
    })
}

const gitCredentials = function gitCredentials(git) {
  return new Promise(
    (resolve, reject) => {
      log.info('Setting up Git Credentials')
      fs.writeFile(`${process.env.HOME}/.git-credentials`, `https://${githubToken}:@github.com\n`, (err) => {
        if (err) {
          reject(err)
        } else {
          resolve(git)
        }
      })
    })
}

const checkAuth = function checkAuth(req) {
  return new Promise(
    (resolve, reject) => {
      if (req.query.auth === authToken) {
        resolve(req)
      } else {
        reject({
          status: 401,
          message: 'Access Denied',
        })
      }
    })
}

const deleteBranch = function deleteBranch(git) {
  return new Promise(
    (resolve, reject) => {
      exec(`rm -rf ${git.path}`)
        .then(() => {
          log.debug('Delete Successful')
          resolve({
            message: `${git.branch} Delete Successful`,
          })
        })
        .catch((err) => {
          log.debug(`Failed to Delete ${git.path} - ${err}`)
          reject({
            status: 500,
            message: `Failed to Delete ${git.branch}`,
          })
        })
    })
}

const gitClone = function gitClone(git) {
  return new Promise(
    (resolve, reject) => {
      exec(`git clone ${git.url} ${git.path}`)
        .then(() => {
          log.debug('Git Clone Successful')
          resolve(git)
        })
        .catch((err) => {
          log.debug(`Failed to Clone ${git.url} ${git.path} - ${err}`)
          reject({
            status: 500,
            message: `Failed to Clone ${git.branch}`,
          })
        })
    })
}

const gitCheckout = function gitCheckout(git) {
  return new Promise(
    (resolve, reject) => {
      chdir(git.path, () => {
        exec(`git checkout ${git.branch}`)
          .then(() => {
            log.debug('Git Checkout Successful')
            resolve(`Git Clone and Checkout of ${git.branch} Successful`)
          })
          .catch((err) => {
            log.debug(`Failed to Checkout ${git.branch} ${git.path} - ${err}`)
            reject({
              status: 500,
              message: `Failed to Checkout ${git.branch}`,
            })
          })
      })
    })
}

const gitPull = function gitPull(git) {
  return new Promise(
    (resolve, reject) => {
      chdir(git.path, () => {
        exec('git pull')
          .then(() => {
            log.debug('Git Pull Successful')
            resolve(`Git Pull of ${git.branch} Successful`)
          })
          .catch((err) => {
            log.debug(`Failed to Pull ${git.branch} ${git.path} - ${err}`)
            reject({
              status: 500,
              message: `Failed to Pull ${git.branch}`,
            })
          })
      })
    })
}

const initialClone = function initialClone(git) {
  return new Promise(
    (resolve, reject) => {
      if (fs.existsSync(git.path)) {
        log.debug(`${git.path} exists - Pull`)

        gitPull(git)
          .then((message) => { resolve(message) })
          .catch((err) => { reject(err) })
      } else {
        log.debug(`${git.path} does not exist - Clone and Checkout`)

        gitClone(git)
          .then(gitCheckout)
          .then((message) => { resolve(message) })
          .catch((err) => { reject(err) })
      }
    })
}

const parseHook = function parseHook(req) {
  return new Promise(
    (resolve, reject) => {
      const type = req.get('X-GitHub-Event')
      log.debug(`Event Type: ${type}`)
      log.silly('Body Object')
      log.silly(JSON.stringify(req.body, null, 4))

      if (type === 'push') {
        const branch = (req.body.ref).split('/')[2]
        const git = {
          branch,
          path: `${puppetPath}/${branch}`,
          url: req.body.repository.clone_url,
        }

        log.debug('Git Object')
        log.debug(JSON.stringify(git, null, 4))

        if (req.body.deleted === true) {
          log.debug('Delete Branch')

          deleteBranch(git)
            .then((message) => { resolve(message) })
            .catch((err) => { reject(err) })
        } else if (fs.existsSync(git.path)) {
          log.debug(`${git.path} exists - Pull`)

          gitPull(git)
            .then((message) => { resolve(message) })
            .catch((err) => { reject(err) })
        } else {
          log.debug(`${git.path} does not exist - Clone and Checkout`)

          gitClone(git)
            .then(gitCheckout)
            .then((message) => { resolve(message) })
            .catch((err) => { reject(err) })
        }
      } else {
        resolve({
          message: 'Not a push message. Doing nothing',
        })
      }
    })
}

const app = express()
const format = morganJson({
  client_ip: ':remote-addr',
  method: ':method',
  url: ':url',
  status: ':status',
  response_time: ':response-time',
})
app.use(morgan(format))
app.use(bodyParser.json())

app.get('/_status', (req, res) => {
  res.status(200).json({ status: 'OK' })
})

app.post('/puppet-webhook', (req, res) => {
  checkAuth(req)
    .then(parseHook)
    .then((message) => {
      res.status(200).json({ message })
    })
    .catch((err) => {
      res.status(err.status).json({ message: err.message })
    })
})

app.listen(3000, () => {
  if (!authToken) {
    log.error('AUTH_TOKEN required')
    process.exit(1)
  } else if (!githubToken) {
    log.error('GITHUB_TOKEN required')
    process.exit(1)
  } else if (!initialGitRepoUrl) {
    log.error('INITIAL_GIT_REPO_URL required')
    process.exit(1)
  } else {
    const git = {
      branch: initialGitBranch,
      path: `${puppetPath}/${initialGitBranch}`,
      url: initialGitRepoUrl,
    }
    log.info(`Getting initial catalog - ${git.url} ${git.branch}`)

    gitConfig(git)
      .then(gitCredentials)
      .then(initialClone)
      .then((message) => {
        log.info(message)
        log.info('Setup Complete')
      })
      .catch((err) => {
        log.error(err)
        process.exit(1)
      })
  }
})
