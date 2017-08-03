# puppet-webhook
Simple service to receive github webhooks to update puppet environments.

URL for hook https://somepuppetserver.example.com/puppet-webhook?auth=RanDomToken

Set to `application/json`

Share the puppet code volume and Run with these env vars.

```yaml
volumes:
  - /etc/puppet/puppetlabs/code:/code
environment:
  - AUTH_TOKEN=RanDomToken # Use something long here, this must match 'auth=' query string
  - GITHUB_TOKEN=${GITHUB_TOKEN}
  - LOG_LEVEL=debug
  - INITIAL_GIT_REPO_URL=https://github.com/<your org>/puppet.git
  - INITIAL_GIT_BRANCH=production
```
