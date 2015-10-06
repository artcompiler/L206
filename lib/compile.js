/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil; tab-width: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
/* Copyright (c) 2015, Art Compiler LLC */

"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _assertJs = require("./assert.js");

var _http = require("http");

var http = _interopRequireWildcard(_http);

var _querystring = require("querystring");

var querystring = _interopRequireWildcard(_querystring);

(0, _assertJs.reserveCodeRange)(1000, 1999, "compile");
_assertJs.messages[1001] = "Node ID %1 not found in pool.";
_assertJs.messages[1002] = "Invalid tag in node with Node ID %1.";
_assertJs.messages[1003] = "No async callback provided.";
_assertJs.messages[1004] = "No visitor method defined for '%1'.";

var translate = (function () {
  var nodePool = undefined;
  function translate(pool, resume) {
    console.log("pool=" + JSON.stringify(pool, null, 2));
    nodePool = pool;
    return visit(pool.root, {}, resume);
  }
  function error(str, nid) {
    return {
      str: str,
      nid: nid };
  }
  function visit(nid, options, resume) {
    (0, _assertJs.assert)(typeof resume === "function", (0, _assertJs.message)(1003));
    // Get the node from the pool of nodes.
    var node = undefined;
    if (typeof nid === "object") {
      node = nid;
    } else {
      node = nodePool[nid];
    }
    (0, _assertJs.assert)(node, (0, _assertJs.message)(1001, [nid]));
    (0, _assertJs.assert)(node.tag, (0, _assertJs.message)(1001, [nid]));
    (0, _assertJs.assert)(typeof table[node.tag] === "function", (0, _assertJs.message)(1004, [JSON.stringify(node.tag)]));
    return table[node.tag](node, options, resume);
  }
  // BEGIN VISITOR METHODS
  var edgesNode = undefined;
  function str(node, options, resume) {
    var val = node.elts[0];
    resume([], {
      value: val
    });
  }
  function num(node, options, resume) {
    var val = node.elts[0];
    resume([], {
      value: val
    });
  }
  function ident(node, options, resume) {
    var val = node.elts[0];
    resume([], [val]);
  }
  function bool(node, options, resume) {
    var val = node.elts[0];
    resume([], [val]);
  }
  function add(node, options, resume) {
    visit(node.elts[0], options, function (err1, val1) {
      val1 = +val1.value;
      if (isNaN(val1)) {
        err1 = err1.concat(error("Argument must be a number.", node.elts[0]));
      }
      visit(node.elts[1], options, function (err2, val2) {
        val2 = +val2.value;
        if (isNaN(val2)) {
          err2 = err2.concat(error("Argument must be a number.", node.elts[1]));
        }
        resume([].concat(err1).concat(err2), val1 + val2);
      });
    });
  };
  function style(node, options, resume) {
    visit(node.elts[0], options, function (err1, val1) {
      visit(node.elts[1], options, function (err2, val2) {
        //        console.log("style() val1=" + JSON.stringify(val1));
        resume([].concat(err1).concat(err2), {
          value: val1,
          style: val2 });
      });
    });
  };
  function list(node, options, resume) {
    if (node.elts && node.elts.length > 1) {
      visit(node.elts[0], options, function (err1, val1) {
        node.elts.shift();
        list(node, options, function (err2, val2) {
          resume([].concat(err1).concat(err2), [].concat(val1).concat(val2));
        });
      });
    } else if (node.elts && node.elts.length === 0) {
      visit(node.elts[0], options, function (err1, val1) {
        resume([].concat(err1), [].concat(val1));
      });
    } else {
      resume([], []);
    }
  };
  function binding(node, options, resume) {
    visit(node.elts[0], options, function (err1, val1) {
      visit(node.elts[1], options, function (err2, val2) {
        resume([].concat(err1).concat(err2), { key: val1, val: val2 });
      });
    });
  };
  function record(node, options, resume) {
    if (node.elts && node.elts.length > 1) {
      visit(node.elts[0], options, function (err1, val1) {
        node.elts.shift();
        record(node, options, function (err2, val2) {
          resume([].concat(err1).concat(err2), [].concat(val1).concat(val2));
        });
      });
    } else if (node.elts && node.elts.length > 0) {
      visit(node.elts[0], options, function (err1, val1) {
        resume([].concat(err1), [].concat(val1));
      });
    } else {
      resume([], []);
    }
  };
  function exprs(node, options, resume) {
    if (node.elts && node.elts.length > 1) {
      visit(node.elts[0], options, function (err1, val1) {
        node.elts.shift();
        exprs(node, options, function (err2, val2) {
          resume([].concat(err1).concat(err2), [].concat(val1).concat(val2));
        });
      });
    } else if (node.elts && node.elts.length > 0) {
      visit(node.elts[0], options, function (err1, val1) {
        resume([].concat(err1), [].concat(val1));
      });
    } else {
      resume([], []);
    }
  };
  function program(node, options, resume) {
    if (!options) {
      options = {};
    }
    visit(node.elts[0], options, function (err, val) {
      resume(err, val);
    });
  }
  function get(path, data, resume) {
    if (data) {
      path += "?" + querystring.stringify(data);
    }
    path = path.trim().replace(/ /g, "+");
    //    console.log("get() path=" + path);
    var options = {
      method: "GET",
      host: "www.graffiticode.com",
      path: path };
    var req = http.get(options, function (res) {
      var data = "";
      res.on("data", function (chunk) {
        data += chunk;
      }).on("end", function () {
        //        console.log("data=" + data);
        try {
          resume([], JSON.parse(data));
        } catch (e) {
          console.log("parse error: " + e.stack);
        }
      }).on("error", function () {
        console.log("error() status=" + res.statusCode + " data=" + data);
      });
    });
  }
  function getItems(list, resume) {
    // Handle legacy case
    var path = "/items";
    var encodedData = JSON.stringify(list);
    var options = {
      host: "www.graffiticode.com",
      port: "80",
      path: "/items",
      method: "GET",
      headers: {
        "Content-Type": "utf8",
        "Content-Length": encodedData.length
      } };
    var obj = null;
    var req = http.request(options, function (res) {
      var data = "";
      res.on("data", function (chunk) {
        data += chunk;
      });
      res.on("end", function () {
        //        console.log("getItems() data=" + data);
        resume([], data);
      });
    });
    req.write(encodedData);
    req.end();
    req.on("error", function (e) {
      console.log("ERR01 " + e);
      response.send(e);
    });
  }
  var ITEM_COUNT = 1000;
  function loadItems(list, data, resume) {
    var sublist = list.slice(0, ITEM_COUNT);
    getItems(list, function (err, str) {
      var obj = JSON.parse(str);
      for (var i = 0; i < obj.length; i++) {
        data.push(obj[i]);
      }
      list = list.slice(ITEM_COUNT);
      if (list.length > 0) {
        loadItems(list, data, resume);
      } else {
        resume([], data);
      }
    });
  }

  function getAlphaNumericPrefix(str) {
    var code, i, len;
    var result = "";
    for (i = 0, len = str.length; i < len; i++) {
      code = str.charCodeAt(i);
      if (!(code > 47 && code < 58) && // numeric (0-9)
      !(code > 64 && code < 91) && // upper alpha (A-Z)
      !(code > 96 && code < 123)) {
        // lower alpha (a-z)
        return result;
      }
      result += str.charAt(i);
    }
    return result;
  }

  function getRootName(str) {
    // data "CCSS.Math.Content.8"
    var start = str.indexOf("data");
    str = str.substring(start + "data".length);
    obj = str.split("\"");
    return obj[1];
  }

  function getNodeFromPool(name, pool, parent) {
    var node;
    if (!(node = pool[name])) {
      // Add a node to the pool.
      node = pool[name] = {
        name: name,
        children: [],
        names: {} };
      parent.push(node);
    }
    return node;
  }

  function parseItemName(rootName, str, pool, parent) {
    // #CCSS.Math.Content.8.EE.C.7
    // A pool is an hash table, aka object.
    //    rootName = getRootName(rootName);
    var start = str.indexOf(rootName);
    str = str.substring(start);
    var name = rootName;
    var node = getNodeFromPool(name, pool, parent);
    str = str.substring(rootName.length);
    while (str.charAt(0) === ".") {
      str = str.substring(1);
      var part = getAlphaNumericPrefix(str);
      name += "." + part;
      node = getNodeFromPool(name, pool, node.children);
      str = str.substring(part.length);
    }
    return node;
  }

  var START = 1;
  var METHOD = 2;
  var OPTION = 3;
  var STRING1 = 4;
  var STRING2 = 5;
  var END = 6;

  function parseSrc(str) {
    if (!str) {
      return;
    }
    var c,
        brks = [0],
        state = START;
    var method = "";
    var option = "";
    var arg1 = "";
    var arg2 = "";
    var i = 0;
    while (i < str.length) {
      c = str[i++];
      switch (state) {
        case START:
          switch (c) {
            case " ":
            case "\n":
            case "\t":
              continue; // Eat whitespace.
            case "|":
              while ((c = str[i++]) !== "\n" && c) {}
              continue;
            default:
              state = METHOD;
              method += c;
              continue;
          }
          break;
        case METHOD:
          switch (c) {
            case " ":
            case "\n":
            case "\t":
              state = OPTION;
              method += " ";
              continue; // Found end of method.
            case "|":
              while ((c = str[i++]) !== "\n" && c) {}
              continue;
            case "\"":
              state = STRING1;
              continue; // Found end of method.
            default:
              method += c;
              continue;
          }
          break;
        case OPTION:
          switch (c) {
            case "\"":
              i--;
              state = STRING1;
              continue; // Found beginning of string.
            case "|":
              while ((c = str[i++]) !== "\n" && c) {}
              continue;
            default:
              method += c;
              break;
          }
          break;
        case STRING1:
          switch (c) {
            case "\"":
              while ((c = str[i++]) !== "\"" && c) {
                arg1 += c;
              }
              if (method.indexOf("is") >= 0 && method.indexOf("isUnit") < 0) {
                // One argument function
                state = END;
                continue;
              } else {
                state = STRING2;
                continue; // Found end of string.
              }
            case "|":
              while ((c = str[i++]) !== "\n" && c) {}
              continue;
            default:
              continue; // Eat whitespace.
          }
          break;
        case STRING2:
          switch (c) {
            case "\"":
              while ((c = str[i++]) !== "\"" && c) {
                arg2 += c;
              }
              state = END;
              continue; // Found end of string.
            case "|":
              while ((c = str[i++]) !== "\n" && c) {}
              continue;
            default:
              continue; // Eat whitespace.
          }
          continue;
        case END:
          // Eat chars until done.
          break;
      }
    }
    return {
      method: method,
      arg1: arg1,
      arg2: arg2 };
  }

  // obj in, tree of nodes out
  var depth = 0;
  var breadth = 0;
  function objToTree(obj, parent, names) {
    var nodes = [];
    Object.keys(obj).forEach(function (name) {
      var n;
      if (!(n = names[name])) {
        names[name] = n = {
          name: name,
          parent: parent,
          children: [],
          svg: RECT,
          size: SIZE };
        nodes.push(n);
      }
      if (!obj[name].hasOwnProperty("score")) {
        n.children = n.children.concat(objToTree(obj[name], name));
      } else {
        n.children = n.children.concat({
          parent: name,
          name: String(obj[name].name),
          score: obj[name].score,
          size: SIZE,
          svg: obj[name].svg,
          src: obj[name].src,
          item: obj[name].item });
      }
      breadth++;
    });
    return nodes;
  }

  function escapeStr(str) {
    return String(str).replace(/\\/g, "\\\\").replace(/{/g, "{").replace(/}/g, "}");
  }

  function stripNewlines(str) {
    return String(str).replace(/\n/g, " ");
  }

  function unescapeXML(str) {
    return String(str).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "'");
  }

  var SIZE = 100;
  var RECT = "<svg xmlns='http://www.w3.org/2000/svg'><g><rect width='0px' height='0px'/></g></svg>";
  var ITEM_COUNT = 20;

  function data(node, options, resume) {
    visit(node.elts[0], options, function (err, val) {
      var source = val.value;
      get("/pieces/L106?q=" + val.value, null, function (err, val) {
        //        console.log("get() val=" + JSON.stringify(val, null, 2));
        var list = [];
        for (var i = 0; i < val.length; i++) {
          list[i] = val[i].id;
        }
        loadItems(list, [], function (err, obj) {
          var c,
              i = 0;
          var data = [];
          var children = [];
          var names = {};
          obj.forEach(function (val) {
            /*
                        try {
                          var val = JSON.parse(val.obj);
            //            if (val.language !== "L106" || val.label !== "show") {
            //              console.log("val=" + JSON.stringify(val, null, 2));
            //              return;
            //            }
            //            console.log("data() obj.response=" + val.response);
                          data.push({
                            response: val.response,
                            value: val.value,
                            score: val.score,
                          });
                          } catch (e) {
                          }
                          return;
            */
            try {
              console.log("data() source=" + source + " val=" + JSON.stringify(val, null, 2));
              var item = val.id;
              var src = val.src;
              console.log("data() val.src=" + val.src);
              var srcObj = parseSrc(val.src);
              var method = srcObj.method;
              var value = srcObj.arg2 ? srcObj.arg1 : null;
              var response = srcObj.arg2 ? srcObj.arg2 : srcObj.arg1;
              var node = parseItemName(source, src, names, children);
              var objectCode = val.obj;
              if (!objectCode) {
                return;
              }
              var objStr = escapeStr(unescapeXML(objectCode));
              var objObj = JSON.parse(objStr);
              var valueSVG = objObj.valueSVG;
              var responseSVG = objObj.responseSVG;
              var score = objObj.score;
              var n;
              if (!(n = names[response])) {
                // Add a node to the pool.
                names[response] = n = {
                  name: response,
                  svg: unescapeXML(responseSVG ? responseSVG : RECT),
                  parent: "root",
                  children: [],
                  names: {},
                  size: SIZE };
                node.children.push(n);
              }
              if (value) {
                var o = {};
                o[method] = {
                  name: value,
                  score: score,
                  size: SIZE,
                  svg: unescapeXML(valueSVG ? valueSVG : RECT),
                  src: src,
                  item: item };
                n.children = n.children.concat(objToTree(o, response, n.names));
              } else {
                n.children = n.children.concat({
                  name: method,
                  parent: response,
                  score: score,
                  size: SIZE,
                  svg: RECT,
                  src: src,
                  item: item });
              }
              breadth++;
            } catch (e) {
              console.log(e.stack);
            }
          });
          resume(err, children);
        });
      });
    });
  }
  var table = {
    "PROG": program,
    "EXPRS": exprs,
    "STR": str,
    "NUM": num,
    "IDENT": ident,
    "BOOL": bool,
    "LIST": list,
    "RECORD": record,
    "BINDING": binding,
    "ADD": add,
    "STYLE": style,
    "DATA": data };
  return translate;
})();
var render = (function () {
  function escapeXML(str) {
    return String(str).replace(/&(?!\w+;)/g, "&amp;").replace(/\n/g, " ").replace(/\\/g, "\\\\").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function render(val, resume) {
    resume([], val);
  }
  return render;
})();
var compiler = (function () {
  exports.compile = function compile(pool, resume) {
    // Compiler takes an AST in the form of a node pool and translates it into
    // an object to be rendered on the client by the viewer for this language.
    try {
      translate(pool, function (err, val) {
        //        console.log("translate err=" + JSON.stringify(err, null, 2) + "\nval=" + JSON.stringify(val, null, 2));
        if (err.length) {
          resume(err, val);
        } else {
          render(val, function (err, val) {
            //            console.log("render err=" + JSON.stringify(err, null, 2) + "\nval=" + JSON.stringify(val, null, 2));
            resume(err, val);
          });
        }
      });
    } catch (x) {
      console.log("ERROR with code");
      console.log(x.stack);
      resume("Compiler error", {
        score: 0
      });
    }
  };
})();
exports.compiler = compiler;

//        size: SIZE,
//        svg: RECT,

// Eat comment.

// Eat comment.

// Eat comment.

// Eat comment.

// Eat comment.
