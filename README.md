# OpenID Connect server example

1. Run `docker-compose up -d`
2. Go to `http://localhost:8081` and insert `users.sql` into `oidcprovider` database
3. Go to `https://openidconnect.net/`
4. Fill in the relevant information to test the server:
- Discovery document URL: `http://localhost:8080/.well-known/openid-configuration`
- Authorization token endpoint: `http://localhost:8080/auth`
- Client ID: `foo`
- Client secret: `bar`
- Scope: `openid profile email`
5. Click "Start" and login with `john@doe.com` and `helloworld` as password.