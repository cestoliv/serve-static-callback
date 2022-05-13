import encodeUrl from "encodeurl"
import escapeHtml from "escape-html"
import parseUrl from "parseurl"
import { resolve } from "path"
import send from "send"
import url from "url"
import onFinished from "on-finished"
import express from "express"

interface serveOptions {
	cacheControl?: boolean | undefined,
	dotfiles?: "allow" | "deny" | "ignore" | undefined,
	etag?: boolean | undefined,
	extensions?: string[] | false | undefined,
	fallthrough?: boolean | undefined,
	immutable?: boolean | undefined,
	index?: boolean | string | string[] | undefined,
	lastModified?: boolean | undefined,
	maxAge?: number | string | undefined,
	redirect?: boolean | undefined,
	setHeaders?: ((res: express.Response, path: string, stat: any) => any) | undefined
}

interface serveCallback{
	(req: express.Request, res: express.Response, path: string):void;
}

function serveStaticCb (root: string, options?: serveOptions, cb?: serveCallback): express.RequestHandler {
	return function serveStatic (req: express.Request, res: express.Response, next: express.NextFunction) {
		// get default options
		var defaultOption: serveOptions = {
			cacheControl: true,
			etag: true,
			extensions: false,
			fallthrough: true,
			immutable: false,
			index: "index.html",
			lastModified: true,
			maxAge: 0,
			redirect: true
		}
		options = {...defaultOption, ...options}

		if (req.method !== 'GET' && req.method !== 'HEAD') {
			if (options?.fallthrough) {
				return next()
			}

			// method not allowed
			res.statusCode = 405
			res.setHeader('Allow', 'GET, HEAD')
			res.setHeader('Content-Length', '0')
			res.end()
			return
		}

		// construct directory listener
		var onDirectory = options?.redirect
			? createRedirectDirectoryListener(req)
			: createNotFoundDirectoryListener()

		var forwardError = !options?.fallthrough
		var originalUrl = parseUrl.original(req)!
		var path = parseUrl(req)?.pathname!
		var realPath = path! // will be updated

		// make sure redirect occurs at mount
		if (path === '/' && originalUrl.pathname!.substring(-1) !== '/') {
			path = ''
		}

		// create send stream
		var opts: send.SendOptions = {
			...options,
			root: resolve(root)
		}
		var stream = send(req, path, opts)

		// add directory handler
		stream.on('directory', onDirectory)

		// add headers listener
		if (options?.setHeaders) {
			stream.on('headers', options.setHeaders)
		}

		// add file listener for fallthrough
		if (options?.fallthrough) {
			stream.on('file', function (path) {
				realPath = path
				// once file is determined, always forward error
				forwardError = true
			})
		}

		// forward errors
		var hasError = false
		stream.on('error', function (err) {
			hasError = true
			if (forwardError || !(err.statusCode < 500)) {
				next(err)
				return
			}
			next()
		})

		// callback on finish
		onFinished(res, function () {
			if (!hasError && cb)
				cb(req, res, realPath)
		})

		// pipe
		stream.pipe(res)
	}
}

/**
 * Collapse all leading slashes into a single slash
 * @private
 */

function collapseLeadingSlashes (str: string) {
	for (var i = 0; i < str.length; i++) {
		if (str.charCodeAt(i) !== 0x2f /* / */) {
			break
		}
	}

	return i > 1
		? '/' + str.substring(i)
		: str
}

/**
 * Create a minimal HTML document.
 * @private
 */

function createHtmlDocument (title: string, body: string) {
	return '<!DOCTYPE html>\n' +
		'<html lang="en">\n' +
		'<head>\n' +
		'<meta charset="utf-8">\n' +
		'<title>' + title + '</title>\n' +
		'</head>\n' +
		'<body>\n' +
		'<pre>' + body + '</pre>\n' +
		'</body>\n' +
		'</html>\n'
}

/**
 * Create a directory listener that just 404s.
 * @private
 */

function createNotFoundDirectoryListener () {
	return function (this: send.SendStream) {
		this.error(404)
	}
}

/**
 * Create a directory listener that performs a redirect.
 * @private
 */

function createRedirectDirectoryListener (req: express.Request) {
	return function redirect (this: send.SendStream, res: express.Response) {
		if (this.hasTrailingSlash()) {
			this.error(404)
			return
		}

		// get original URL
		var originalUrl = parseUrl.original(req)!

		// append trailing slash
		originalUrl.path = null
		originalUrl.pathname = collapseLeadingSlashes(originalUrl.pathname + '/')

		// reformat the URL
		var loc = encodeUrl(url.format(originalUrl))
		var doc = createHtmlDocument('Redirecting', 'Redirecting to <a href="' + escapeHtml(loc) + '">' +
			escapeHtml(loc) + '</a>')

		// send redirect response
		res.statusCode = 301
		res.setHeader('Content-Type', 'text/html; charset=UTF-8')
		res.setHeader('Content-Length', Buffer.byteLength(doc))
		res.setHeader('Content-Security-Policy', "default-src 'none'")
		res.setHeader('X-Content-Type-Options', 'nosniff')
		res.setHeader('Location', loc)
		res.end(doc)
	}
}

export = serveStaticCb
