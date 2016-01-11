"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.compiler = undefined;

var _assert = require("./assert.js");

function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; } /* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil; tab-width: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
/* Copyright (c) 2015, Art Compiler LLC */

(0, _assert.reserveCodeRange)(1000, 1999, "compile");
_assert.messages[1001] = "Node ID %1 not found in pool.";
_assert.messages[1002] = "Invalid tag in node with Node ID %1.";
_assert.messages[1003] = "No async callback provided.";
_assert.messages[1004] = "No visitor method defined for '%1'.";

var translate = (function () {
  var nodePool = undefined;
  function translate(pool, resume) {
    nodePool = pool;
    return visit(pool.root, {}, resume);
  }
  function error(str, nid) {
    return {
      str: str,
      nid: nid
    };
  }
  function visit(nid, options, resume) {
    (0, _assert.assert)(typeof resume === "function", (0, _assert.message)(1003));
    // Get the node from the pool of nodes.
    var node = undefined;
    if ((typeof nid === "undefined" ? "undefined" : _typeof(nid)) === "object") {
      node = nid;
    } else {
      node = nodePool[nid];
    }
    (0, _assert.assert)(node, (0, _assert.message)(1001, [nid]));
    (0, _assert.assert)(node.tag, (0, _assert.message)(1001, [nid]));
    (0, _assert.assert)(typeof table[node.tag] === "function", (0, _assert.message)(1004, [JSON.stringify(node.tag)]));
    return table[node.tag](node, options, resume);
  }
  // BEGIN VISITOR METHODS
  var edgesNode = undefined;
  function num(node, options, resume) {
    var val = node.elts[0];
    resume([], val);
  };

  function program(node, options, resume) {
    if (!options) {
      options = {};
    }
    visit(node.elts[0], options, function (err, val) {
      resume(err, val);
    });
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

  function binding(node, options, resume) {
    visit(node.elts[0], options, function (err1, val1) {
      visit(node.elts[1], options, function (err2, val2) {
        resume([].concat(err1).concat(err2), { key: val1, val: val2 });
      });
    });
  };

  function set(node, options, resume, params) {
    visit(node.elts[0], options, function (err, val) {
      if ((typeof val === "undefined" ? "undefined" : _typeof(val)) !== "object" || !val || val.play !== true) {
        err = err.concat(error("Argument Data invalid.", node.elts[0]));
      } else {
        if (params.op && params.op === "default") {
          if (val) {
            val[params.prop] = params.val;
          }
        } else if (params.op && params.op === "positive") {
          visit(node.elts[1], options, function (err2, val2) {
            if (isNaN(val2) || val2 <= 0) {
              err2 = err2.concat(error("Argument must be a positive number.", node.elts[1]));
            }
            if (val) {
              val[params.prop] = +val2;
            }
            err = err.concat(err2);
          });
        } else if (params.op && params.op === "color") {
          visit(node.elts[1], params, function (err2, val2) {
            if (!(val2 instanceof Array)) {
              err2 = err2.concat(error("Please provide a valid array of colors.", node.elts[1]));
            } else {
              var ret = [];
              val2.forEach(function (element, index, array) {
                if (typeof element === "string" && /^#[0-9A-F]{6}$/i.test(element)) {
                  ret = ret.concat(element);
                } else if (!isNaN(element.r) && !isNaN(element.g) && !isNaN(element.b)) {
                  var r = element.r.toString(16);
                  r = r.length == 1 ? "0" + r : r;
                  var g = element.g.toString(16);
                  g = g.length == 1 ? "0" + g : g;
                  var b = element.b.toString(16);
                  b = b.length == 1 ? "0" + b : b;
                  ret = ret.concat("#" + r + g + b);
                } else {
                  err2 = err2.concat(error("Index" + index + " is not a valid hex string or rgb color.", node.elts[1]));
                }
              });
            }
            val[params.prop] = ret;
            err = err.concat(err2);
          });
        } else if (params.op && params.op === "string") {
          visit(node.elts[1], params, function (err2, val2) {
            val[params.prop] = { label: val2 };
            err = err.concat(err2);
          });
        }
      }
      resume([].concat(err), val);
    });
  };

  function rgb(node, options, resume) {
    var ret = {
      r: 0,
      g: 0,
      b: 0
    };
    visit(node.elts[0], options, function (err1, val1) {
      //b
      if (isNaN(val1) || val1 < 0 || +val1 > 255) {
        err1 = err1.concat(error("Argument must be between 0 and 255.", node.elts[0]));
      }
      ret.b = +val1;
      visit(node.elts[1], options, function (err2, val2) {
        //g
        if (isNaN(val2) || val2 < 0 || +val2 > 255) {
          err2 = err2.concat(error("Argument must be between 0 and 255.", node.elts[1]));
        }
        ret.g = +val2;
        visit(node.elts[2], options, function (err3, val3) {
          //r
          if (isNaN(val3) || val3 < 0 || +val3 > 255) {
            err3 = err3.concat(error("Argument must be between 0 and 255.", node.elts[2]));
          }
          ret.r = +val3;
          resume([].concat(err1).concat(err2).concat(err3), ret);
        });
      });
    });
  };

  function play(node, options, resume) {
    resume([], {
      play: true,
      grid: 4,
      size: 500,
      spacing: 15,
      round: 3,
      goal: 2048,
      seed: [2, 2, 2, 2, 2, 2, 2, 2, 2, 4],
      mode: [false, false, 0],
      tilecolor: ['#eee4da', '#edc22e']
    });
  };

  function grid(node, options, resume) {
    var params = {
      op: "positive",
      prop: "grid"
    };
    set(node, options, function (err, val) {
      resume([].concat(err), val);
    }, params);
  };

  function size(node, options, resume) {
    var params = {
      op: "positive",
      prop: "size"
    };
    set(node, options, function (err, val) {
      resume([].concat(err), val);
    }, params);
  };

  function spacing(node, options, resume) {
    var params = {
      op: "positive",
      prop: "spacing"
    };
    set(node, options, function (err, val) {
      resume([].concat(err), val);
    }, params);
  };

  function goal(node, options, resume) {
    var params = {
      op: "positive",
      prop: "goal"
    };
    set(node, options, function (err, val) {
      resume([].concat(err), val);
    }, params);
  };

  function seed(node, options, resume) {
    visit(node.elts[1], options, function (err2, val2) {
      if (val2 instanceof Array && val2.length) {
        if (!val2.every(function (element, index, array) {
          return !isNaN(element);
        })) {
          err2 = err2.concat(error("All given values must be numbers.", node.elts[1]));
        }
      } else {
        if (isNaN(val2)) {
          err2 = err2.concat(error("Please provide a number or array of numbers.", node.elts[1]));
        }
        val2 = [val2];
      }
      var params = {
        op: "default",
        prop: "seed",
        val: val2
      };
      set(node, options, function (err1, val1) {
        resume([].concat(err1).concat(err2), val1);
      }, params);
    });
  };

  function mode(node, options, resume) {
    visit(node.elts[1], options, function (err2, val2) {
      var ret = [false, false, 0]; //button, any, currentmode

      if (val2.endsWith('threes')) {
        ret[2] = 3;
      } else if (val2.endsWith('fibb')) {
        ret[2] = 4;
      } else {
        //make a switch statement for div/mult/add using endsWith
        var test = val2.split(" ");
        switch (test[test.length - 1]) {
          case 'add':
          case 'addition':
            ret[2] = 0; //default is 'addition without any or button', of course.
            break;
          case 'mult':
          case 'multiply':
          case 'multiplication':
            ret[2] = 1;
            break;
          case 'div':
          case 'divide':
          case 'division':
            ret[2] = 2;
            break;
        }
        ret[0] = val2.indexOf('button') >= 0;
        ret[1] = val2.indexOf('any') >= 0;
        //check for any and button with indexOf
      }
      var params = {
        op: "default",
        prop: "mode",
        val: ret
      };
      set(node, options, function (err1, val1) {
        resume([].concat(err1).concat(err2), val1);
      }, params);
    });
  };

  function round(node, options, resume) {
    var params = {
      op: "positive",
      prop: "round"
    };
    set(node, options, function (err, val) {
      resume([].concat(err), val);
    }, params);
  };

  function tilecolor(node, options, resume) {
    var params = {
      op: "color",
      prop: "tilecolor"
    };
    set(node, options, function (err, val) {
      resume([].concat(err), val);
    }, params);
  };

  function style(node, options, resume) {
    visit(node.elts[1], options, function (err2, val2) {
      //array of key value objects
      //first, check to make sure it IS an array of key value objects
      if (val2 instanceof Array && val2.length) {
        //if so, forEach it
        visit(node.elts[0], options, function (err1, val1) {
          if ((typeof val1 === "undefined" ? "undefined" : _typeof(val1)) !== "object" || !val1 || val1.play !== true) {
            err1 = err1.concat(error("Argument Data invalid.", node.elts[0]));
          } else {
            val2.forEach(function (element, index, array) {
              if (element.key && element.val) {
                //within that loop, check through the list of possible objects
                //if found, check if object[key] is defined
                //if not, object[key] = value
                if (val1.title) {
                  if (!val1.title[element.key]) {
                    val1.title[element.key] = element.val;
                  }
                }
                if (val1.description) {
                  if (!val1.description[element.key]) {
                    val1.description[element.key] = element.val;
                  }
                }
                if (val1.score) {
                  if (!val1.score[element.key]) {
                    val1.score[element.key] = element.val;
                  }
                }
              } else {
                err2 = err2.concat(error("Index " + index + " is an invalid object.", node.elts[1]));
              }
            });
          }
          resume([].concat(err1).concat(err2), val1);
        });
      } else {
        err2 = err2.concat(error("Invalid parameters.", node.elts[1]));
        resume([].concat(err2), val2);
      }
    });
  };

  function title(node, options, resume) {
    var params = {
      op: "string",
      prop: "title"
    };
    set(node, options, function (err, val) {
      resume([].concat(err), val);
    }, params);
  };

  function description(node, options, resume) {
    var params = {
      op: "string",
      prop: "description"
    };
    set(node, options, function (err, val) {
      resume([].concat(err), val);
    }, params);
  };

  function score(node, options, resume) {
    var params = {
      op: "default",
      prop: "score",
      val: { label: true }
    };
    set(node, options, function (err, val) {
      resume([].concat(err), val);
    }, params);
  };

  function button(node, options, resume) {};

  var table = {
    "PROG": program,
    "EXPRS": exprs,
    "RECORD": exprs,
    "LIST": exprs,
    "BINDING": binding,
    "NUM": num,
    "STR": num,
    "BOOL": num,
    "IDENT": num,
    "PLAY": play,
    "GRID": grid,
    "SIZE": size,
    "SPACING": spacing,
    "GOAL": goal,
    "SEED": seed,
    "MODE": mode,
    "ROUND": round,
    "TILECOLOR": tilecolor,
    "RGB": rgb,
    "STYLE": style,
    "TITLE": title,
    "DESCRIPTION": description,
    "SCORE": score,
    "BUTTON": button
  };
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
var compiler = exports.compiler = (function () {
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
  };
})();
