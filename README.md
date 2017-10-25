# puppet-webhook

https://hub.docker.com/r/jgreat/puppet-webhook/

Simple service in a docker container to receive GitHub webhooks to update puppet environments.

Each branch gets cloned as a Puppet Environment. When namimg branches you need to use Underscores as a seperator. Dashes are not valid in Puppet Environment names.

### Authentication Token

Pick any kind of random url safe string and set the `auth=<token>` in the Payload URL to match the AUTH_TOKEN environment varaible presented to the container.

### SSL

This doesn't include ssl. Put some kind of ssl proxy (AWS ELB, NGINX...) in front of this container.

### Github Webhook Setup

* Payload URL: `https://somepuppetserver.example.com/puppet-webhook?auth=RanDomToken`
* Content-Type: `application/json`
* Let Me Select Indvidual Events: `Delete`, `Push`

### Docker Compose Setup

Share the puppet code directory as a volume and run with these env vars.

```yaml
version "2"
services:
  puppet-webhook:
    image: jgreat/puppet-webhook:0.0.3
    expose:
      - 3000/tcp
    volumes:
      - /etc/puppetlabs/puppet
    environment:
      - AUTH_TOKEN=RanDomToken
      - GITHUB_TOKEN=${github_token}
      - INITIAL_GIT_REPO_URL=https://github.com/<your org>/puppet.git
      - INITIAL_GIT_BRANCH=production
```

### Environment Variables

* `AUTH_TOKEN=RanDomToken` - Use something long here, this must match 'auth=' query string
* `GITHUB_TOKEN=<Github Access Token>` - GitHub personal access token.
* `LOG_LEVEL=info` - Set to `debug` for more info.
* `INITIAL_GIT_REPO_URL=https://github.com/<your org>/puppet.git` - https url to your puppet code repo
* `INITIAL_GIT_BRANCH=production` Initial branch to download, should match your default environment
