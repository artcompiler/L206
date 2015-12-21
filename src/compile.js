/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil; tab-width: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
/* Copyright (c) 2015, Art Compiler LLC */

import {assert, message, messages, reserveCodeRange} from "./assert.js";

reserveCodeRange(1000, 1999, "compile");
messages[1001] = "Node ID %1 not found in pool.";
messages[1002] = "Invalid tag in node with Node ID %1.";
messages[1003] = "No async callback provided.";
messages[1004] = "No visitor method defined for '%1'.";

let translate = (function() {
  let nodePool;
  function translate(pool, resume) {
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
  function num(node, options, resume) {
    let val = node.elts[0];
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

  function set(node, options, resume, params){
    visit(node.elts[0], options, function (err, val) {
      if(typeof val !== "object" || !val || val.play !== true){
        err = err.concat(error("Argument Data invalid.", node.elts[0]));
      } else {
        if(params.op && params.op === "default"){
          if(val){val[params.prop] = params.val;}
        } else if(params.op && params.op === "positive"){
          visit(node.elts[1], options, function (err2, val2) {
            if(isNaN(val2) || val2 <= 0){
              err2 = err2.concat(error("Argument must be a positive number.", node.elts[1]));
            }
            if(val){val[params.prop] = +val2;}
            err = err.concat(err2);
          });
        }
      }
      resume([].concat(err), val);
    });
  };

  function play(node, options, resume) {
    resume([], {
      play: true, 
      grid: 4,
      size: 500,
      spacing: 15,
      goal: 2048,
      seed: 2,
      mode: [false, false, 0],
    });
  };

  function grid(node, options, resume) {
    let params = {
      op: "positive",
      prop: "grid"
    };
    set(node, options, function (err, val) {
      resume([].concat(err), val);
    }, params);
  };

  function size(node, options, resume) {
    let params = {
      op: "positive",
      prop: "size"
    };
    set(node, options, function (err, val) {
      resume([].concat(err), val);
    }, params);
  };

  function spacing(node, options, resume) {
    let params = {
      op: "positive",
      prop: "spacing"
    };
    set(node, options, function (err, val) {
      resume([].concat(err), val);
    }, params);
  };

  function goal(node, options, resume) {
    let params = {
      op: "positive",
      prop: "goal"
    };
    set(node, options, function (err, val) {
      resume([].concat(err), val);
    }, params);
  };

  function seed(node, options, resume) {
    let params = {
      op: "positive",
      prop: "seed"
    };
    set(node, options, function (err, val) {
      resume([].concat(err), val);
    }, params);
  };

  function mode(node, options, resume) {
    visit(node.elts[1], options, function (err2, val2) {
      let ret = [false, false, 0];//button, any, currentmode
      if(val2.endsWith('fibb')){
        ret[2] = 3;
      } else {
        //make a switch statement for div/mult/add using endsWith
        var test = val2.split(" ");
        switch(test[test.length-1]){
          case 'add':
          case 'addition':
            ret[2] = 0;//default is 'addition without any or button', of course.
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
        ret[0] = (val2.indexOf('button') >= 0);
        ret[1] = (val2.indexOf('any') >= 0);
        //check for any and button with indexOf
      }
      let params = {
        op: "default",
        prop: "mode",
        val: ret,
      };
      set(node, options, function (err1, val1) {
        resume([].concat(err1).concat(err2), val1);
      }, params);
    });
  };

  let table = {
    "PROG" : program,
    "EXPRS" : exprs,
    "RECORD" : exprs,
    "LIST" : exprs,
    "NUM": num,
    "STR": num,
    "BOOL": num,
    "IDENT": num,
    "PLAY" : play,
    "GRID" : grid,
    "SIZE" : size,
    "SPACING" : spacing,
    "GOAL" : goal,
    "SEED" : seed,
    "MODE" : mode,
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
