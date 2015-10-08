/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil; tab-width: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
/* Copyright (c) 2015, Art Compiler LLC */

import {assert, message, messages, reserveCodeRange} from "./assert.js";
import * as http from "http";
import * as querystring from "querystring";

reserveCodeRange(1000, 1999, "compile");
messages[1001] = "Node ID %1 not found in pool.";
messages[1002] = "Invalid tag in node with Node ID %1.";
messages[1003] = "No async callback provided.";
messages[1004] = "No visitor method defined for '%1'.";

let translate = (function() {
  let nodePool;
  function translate(pool, resume) {
    console.log("pool=" + JSON.stringify(pool, null, 2));
    nodePool = pool;
    return visit(pool.root, {}, resume);
  }
  function error(str, nid) {
    return {
      str: str,
      nid: nid,
    };
  }
  function visit(nid, options, resume) {
    assert(typeof resume === "function", message(1003));
    // Get the node from the pool of nodes.
    let node;
    if (typeof nid === "object") {
      node = nid;
    } else {
      node = nodePool[nid];
    }
    assert(node, message(1001, [nid]));
    assert(node.tag, message(1001, [nid]));
    assert(typeof table[node.tag] === "function", message(1004, [JSON.stringify(node.tag)]));
    return table[node.tag](node, options, resume);
  }
  // BEGIN VISITOR METHODS
  let edgesNode;
  function str(node, options, resume) {
    let val = node.elts[0];
    resume([], {
      value: val
    });
  }
  function num(node, options, resume) {
    let val = node.elts[0];
    resume([], {
      value: val
    });
  }
  function ident(node, options, resume) {
    let val = node.elts[0];
    resume([], [val]);
  }
  function bool(node, options, resume) {
    let val = node.elts[0];
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
          style: val2,
        });
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
        resume([].concat(err1).concat(err2), {key: val1, val: val2});
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
      path: path,
    };
    var req = http.get(options, function(res) {
      var data = "";
      res.on('data', function (chunk) {
        data += chunk;
      }).on('end', function () {
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
  function getItems(list, sourceOnly, resume) {
    var path;
    // Handle legacy case
    if (sourceOnly) {
      path = "/items/src";
    } else { 
      path = "/items";
    }
    var encodedData = JSON.stringify(list);
    var options = {
      host: "www.graffiticode.com",
      port: "80",
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'utf8',
        'Content-Length': encodedData.length
      },
    };
    var obj = null;
    var req = http.request(options, function(res) {
      var data = "";
      res.on('data', function (chunk) {
        data += chunk;
      });
      res.on('end', function () {
        resume([], data);
      });
    });
    req.write(encodedData);
    req.end();
    req.on('error', function(e) {
      console.log("ERR01 " + e);
      response.send(e);
    });
  }
  var ITEM_COUNT = 1000;
  function loadItems(list, sourceOnly, data, resume) {
    var sublist = list.slice(0, ITEM_COUNT);
    getItems(list, sourceOnly, function (err, str) {
      var obj = JSON.parse(str);
      for (var i = 0; i < obj.length; i++) {
        data.push(obj[i]);
      }
      list = list.slice(ITEM_COUNT);
      if (list.length > 0) {
        loadItems(list, sourceOnly, data, resume);
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
      if (!(code > 47 && code < 58) &&  // numeric (0-9)
          !(code > 64 && code < 91) &&  // upper alpha (A-Z)
          !(code > 96 && code < 123) && // lower alpha (a-z)
          code !== 45 && code !== 95) { // '-', '_'
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
        names: {},
//        size: SIZE,
//        svg: RECT,
      };
      parent.push(node);
    }
    return node;
  }

  function getNode(root, name) {
    var node;
    if (!(node = root[name])) {
      node = root[name] = {
        _: {
          value: 1,
          title: name,
        },
      };
    } else {
      node._.value++;
    }
    return node;
  }

  function parseIndex(rootName, str, root) {
    // #CCSS.Math.Content.8.EE.C.7
    var start = str.indexOf(rootName);
    str = str.substring(start);
    var name = rootName;
    var node = getNode(root, name);
    str = str.substring(rootName.length);
    while (str.charAt(0) === ".") {
      str = str.substring(1);
      var part = getAlphaNumericPrefix(str);
      name += "." + part;
      node = getNode(node, part);
      str = str.substring(part.length);
    }
    return node;
  }

  var START   = 1;
  var METHOD  = 2;
  var OPTION  = 3;
  var STRING1 = 4;
  var STRING2 = 5;
  var END     = 6;

  function parseSrc(str) {
    if (!str) {
      return;
    }
    var c, brks = [0], state = START;
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
          while ((c = str[i++]) !== "\n" && c) {
            // Eat comment.
          }
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
          while ((c = str[i++]) !== "\n" && c) {
            // Eat comment.
          }
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
          while ((c = str[i++]) !== "\n" && c) {
            // Eat comment.
          }
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
          if (method.indexOf("is") >= 0 &&
              method.indexOf("isUnit") < 0) {
            // One argument function
            state = END;
            continue;
          } else {
            state = STRING2;
            continue; // Found end of string.
          }
        case "|":
          while ((c = str[i++]) !== "\n" && c) {
            // Eat comment.
          }
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
          while ((c = str[i++]) !== "\n" && c) {
            // Eat comment.
          }
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
      arg2: arg2,
    };
  }

  function escapeStr(str) {
    return String(str)
      .replace(/\\/g, "\\\\")
      .replace(/{/g, "\{")
      .replace(/}/g, "\}")
  }

  function stripNewlines(str) {
    return String(str)
      .replace(/\n/g, " ")
  }

  function unescapeXML(str) {
    return String(str)
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "'");
  }

  var SIZE = 100;
  var RECT = "<svg xmlns='http://www.w3.org/2000/svg'><g><rect width='0px' height='0px'/></g></svg>";
  var ITEM_COUNT = 20;

  function data(node, options, resume) {
    visit(node.elts[0], options, function (err, val) {
      var indexStr = val.value;
      get("/pieces/L106?q=" + val.value, null, function (err, val) {
//        console.log("get() val=" + JSON.stringify(val, null, 2));
        var list = [];
        for (var i = 0; i < val.length; i++) {
          list[i] = val[i].id;
        }
        loadItems(list, false, [], function (err, obj) {
          var c, i = 0;
          var data = [];
          var children = [];
          var names = {};
          var root = {};
          obj.forEach(function (val) {
            try {
              var item = val.id;
              var src = val.src;
              var srcObj = parseSrc(val.src);
              var method = srcObj.method;
              var value = srcObj.arg2 ? srcObj.arg1 : null;
              var response = srcObj.arg2 ? srcObj.arg2 : srcObj.arg1;
              var node = parseIndex(indexStr, src, root);
              var objectCode = val.obj;
              if (!objectCode) {
                return;
              }
              var objStr = escapeStr(unescapeXML(objectCode));
              var objObj = JSON.parse(objStr);
              var valueSVG = objObj.valueSVG;
              var responseSVG = objObj.responseSVG;
              var score = objObj.score;
              var n, o;
              if (!(n = node[response])) {
                // If no node for response yet, then add one.
                node[response] = n = {
                  _: {
                    image: responseSVG ? unescapeXML(responseSVG) : undefined,
                  }
                };
              }
              if (!(o = n[method])) {
                // If no node for method yet, then add one.
                n[method] = o = {
                };
              }
              if (value) {
                // If there is a value, then add it as a child of the method node.
                o[value] = {
                  _: {
                    value: score > 0 ? 1.1 : 0.9,
                    image: valueSVG ? unescapeXML(valueSVG) : undefined,
                    title: src,
                    link: "/item?id=" + item,
                  }
                };
              } else {
                // If there is no value, the add meta data to it now.
                o._ = {
                  value: score > 0 ? 1.1 : 0.9,
                  title: src,
                  link: "/item?id=" + item,
                };
              }
            } catch (e) {
              //console.log(e.stack);
            }
          });
          resume(err, root);
        });
      });
    });
  }
  function index(node, options, resume) {
    visit(node.elts[0], options, function (err, val) {
      var indexStr = val.value;
      get("/pieces/L106?q=" + val.value, null, function (err, val) {
//        console.log("get() val=" + JSON.stringify(val, null, 2));
        var list = [];
        for (var i = 0; i < val.length; i++) {
          list[i] = val[i].id;
        }
        loadItems(list, true, [], function (err, obj) {
          var c, i = 0;
          var data = [];
          var children = [];
          var names = {};
          var root = {};
          obj.forEach(function (val) {
            try {
              var item = val.id;
              var src = val.src;
              var srcObj = parseSrc(val.src);
              var method = srcObj.method;
              var value = srcObj.arg2 ? srcObj.arg1 : null;
              var response = srcObj.arg2 ? srcObj.arg2 : srcObj.arg1;
              var node = parseIndex(indexStr, src, root);
/*
              var objectCode = val.obj;
              if (!objectCode) {
                return;
              }
              var objStr = escapeStr(unescapeXML(objectCode));
              var objObj = JSON.parse(objStr);
              var valueSVG = objObj.valueSVG;
              var responseSVG = objObj.responseSVG;
              var score = objObj.score;
              var n, o;
              if (!(n = node[response])) {
                // If no node for response yet, then add one.
                node[response] = n = {
                  _: {
                    image: responseSVG ? unescapeXML(responseSVG) : undefined,
                  }
                };
              }
              if (!(o = n[method])) {
                // If no node for method yet, then add one.
                n[method] = o = {
                };
              }
              if (value) {
                // If there is a value, then add it as a child of the method node.
                o[value] = {
                  _: {
                    value: score > 0 ? 1.1 : 0.9,
                    image: valueSVG ? unescapeXML(valueSVG) : undefined,
                    title: src,
                    link: "/item?id=" + item,
                  }
                };
              } else {
                // If there is no value, the add meta data to it now.
                o._ = {
                  value: score > 0 ? 1.1 : 0.9,
                  title: src,
                  link: "/item?id=" + item,
                };
              }
*/
            } catch (e) {
              //console.log(e.stack);
            }
          });
          resume(err, root);
        });
      });
    });
  }
  let table = {
    "PROG" : program,
    "EXPRS" : exprs,
    "STR": str,
    "NUM": num,
    "IDENT": ident,
    "BOOL": bool,
    "LIST": list,
    "RECORD": record,
    "BINDING": binding,
    "ADD" : add,
    "STYLE" : style,
    "DATA": data,
    "INDEX": index,
  }
  return translate;
})();
let render = (function() {
  function escapeXML(str) {
    return String(str)
      .replace(/&(?!\w+;)/g, "&amp;")
      .replace(/\n/g, " ")
      .replace(/\\/g, "\\\\")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function render(val, resume) {
    resume([], val);
  }
  return render;
})();
export let compiler = (function () {
  exports.compile = function compile(pool, resume) {
    // Compiler takes an AST in the form of a node pool and translates it into
    // an object to be rendered on the client by the viewer for this language.
    try {
      translate(pool, function (err, val) {
        if (err.length) {
          resume(err, val);
        } else {
          render(val, function (err, val) {
            if (val instanceof Array && val.length === 1) {
              val = val[0];
            }
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
  }
})();
