# Express static middleware with a callback

Work exactly like [Express static middleware](https://expressjs.com/en/resources/middleware/serve-static.html), but add a callback function.

The callback function is called when a file is returned to the client. IT IS NOT called, if no file is found, nor if a redirection has been performed
# Install
```bash
npm install serve-static-callback
```
# API
```javascript
import serveStaticCb from 'serve-static-callback'
```
## serveStaticCb(root, options, callback)
Create a middleware function, just like Express built-in serve-static.

### Options
The full list of options is on [the official server-static doc](https://expressjs.com/en/resources/middleware/serve-static.html).

### Callback
The function that you want to be executed after the file beeing served.
```javascript
function (req: express.Request, res: express.Response, path: string) {

}
```

## Instead of
```typescript
import express from 'express'

const app = express()
app.use(express.static('public', { dotfiles: "deny" }))
app.listen(80)
```

## You can now
```typescript
import express from 'express'
import serveStaticCb from 'serve-static-callback'

const app = express()
app.use(serveStaticCb('public', { dotfiles: "deny" },
	function (req: express.Request, res: express.Response, path: string) {
		console.log(`A request to ${req.path} has been made, the file ${path} has been served !`)
		// e.g. => A request to / has been made, the file public/index.html has been served !
	})
)
app.listen(80)
```
