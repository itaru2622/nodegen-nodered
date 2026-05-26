# nodegen-nodered

nodegen-nodered is a command line tool to generate Node-RED nodes from OpenAPI (Swagger) document.
It helps developers dramatically reduce the time to implement Node-RED nodes.

This is re-making of https://github.com/node-red/node-red-nodegen, because it is not maintained and dependencies are also maintained.

## Installation

```bash
# direct install from github
npm install -g github:itaru2622/nodegen-nodered
```

You may need to run this with sudo, or from within an Administrator command shell.


## Usage:

```bash
Usage: nodegen-nodered <source file or URL> [options]

Supported source:
 - OpenAPI document v3.0.x in json / yaml

Options:
  -o <dir>          Output directory (default: current directory)
  --prefix <str>    npm module prefix (default: "node-red-contrib-")
  --name <str>      Node name (default: derived from spec title)
  --module <str>    Module name (default: "<prefix><name>")
  --version <str>   Version (e.g. "1.0.0")
  --keywords <str>  Additional keywords (comma-separated)
  --category <str>  Node category (default: "function")
  --icon <file>     Icon file in PNG or SVG (PNG geometry size: 40x60)
  --color <str>     Node color (e.g. "A6BBCF")
  --tgz             Package as .tgz (npm pack)
  --help            Show this help

```

Example: Create an original node from OpenAPI document

```bash
nodegen-nodered https://petstore3.swagger.io/api/v3/openapi.json
cd ~/.node-red
npm install <path-to>/node-red-contrib-swagger-petstore
node-red
```
-> You can use swagger-petstore node on node-RED flow editor.

NOTE:
when specifing URL for nodegen-nodered command,
it supports GET method without authentication.
