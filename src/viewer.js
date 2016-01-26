/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil; tab-width: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
/* Copyright (c) 2015, Jeff Dyer, Art Compiler LLC */
import {assert, message, messages, reserveCodeRange} from "./assert.js";
import {Grid, Tile} from "./grid.js";
import * as React from "react";
import * as D3Test from "./d3Test";
window.exports.viewer = (function () {
  var Game = React.createClass({
    componentDidMount: function() {
      window.addEventListener("keydown", this.handleMove);
    },

    componentWillUnmount: function() {
      window.removeEventListener("keydown", this.handleMove);
    },

    componentDidUpdate: function() {
      var element = d3.select(window.exports.ReactDOM.findDOMNode(this));
      element.select('svg.splash')
        .remove();
      if(!window.dispatcher.isDispatching() && this.props.grid && !this.isGridClean(this.props.grid)){
        this.setup();
      } else if(this.props.data && !this.isGridClean(this.props.grid)){
        D3Test.splashScreen(element, this.props.data, this.setup);
      }
    },

    dispatch: function (data, reset) {
      if(reset){//replace entirely
        window.dispatcher.dispatch({
          data: data
        });
      } else {
        window.dispatcher.dispatch({
          data: {
            grid: (data.grid === undefined) ? this.props.grid : data.grid,
            score: (data.score === undefined) ? this.props.score : data.score,
            over: (data.over === undefined) ? this.props.over : data.over,
            won: (data.won === undefined) ? this.props.won : data.won,
            keepPlaying: (data.keepPlaying === undefined) ? this.props.keepPlaying : data.keepPlaying,
            rule: (data.rule === undefined) ? this.props.rule : data.rule,
            best: (data.score === undefined) ? this.props.best : Math.max(this.props.best, data.score) || 0
          }
        });
      }
    },

    clearBest: function () {
      this.dispatch({
        best: 0
      }, true);
      this.setup();
    },

    keepPlaying: function () {
      //this happens in response to the user input of the 'keep playing' button being pressed.
      this.dispatch({
        keepPlaying: true
      });
    },

    toggle: function () {
      var t = this.props.rule + 1;
      if(t > 2){
        t = 0;
      }
      this.dispatch({
        rule: t
      });
    },

    isGameTerminated: function () {
      return this.props.over || (this.props.won && !this.props.keepPlaying);
    },

    setup: function () {
      //this only occurs if there's no data or we're restarting, so it should just overwrite
      //add start tiles to the grid and then dispatch
      //as such we'll need addStartTiles and addRandomTile, both of which need to be able to operate on an arbitrary grid.
      if(this.props.grid && !this.isGridClean(this.props.grid)){//it just needs cleanup
        var grid = new Grid(this.props.grid.size, this.props.grid.cells);
        this.dispatch({
          grid: grid
        });
      } else {//we're actually resetting 
        var grid = new Grid(this.props.objectCode.size);
        this.addStartTiles(grid, this.props.objectCode.seed);
        grid.flag = 1;
        this.dispatch({
          grid: grid,
          score: 0,
          over: false,
          won: false,
          keepPlaying: false,
          rule: this.props.objectCode.mode[2]
        });
      }
    },

    addStartTiles: function (grid, seed) {
      for(var i = 0; i < grid.size/2; i++) {
        this.addRandomTile(grid, seed);
      }
    },

    addRandomTile: function (grid, seed) {
      if(grid.cellsAvailable()){
        var value = +seed[Math.floor(Math.random()*seed.length)];
        var tile = new Tile(grid.randomAvailableCell(), value);

        grid.insertTile(tile);
      }
    },

    prepareTiles: function (grid) {
      grid.eachCell(function (x, y, tile) {
        if(tile) {
          tile.mergedFrom = null;
          tile.savePosition();
        }
      });
    },

    handleMove: function (event) {
      var map = {
        38: 0, // Up
        39: 1, // Right
        40: 2, // Down
        37: 3, // Left
      };

      var modifiers = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
      var mapped = map[event.which];

      if(!modifiers && this.props.objectCode) {
        if (document.activeElement === document.body && mapped !== undefined) {
          event.preventDefault();
          this.move(mapped);
        } else if(event.which === 82 && this.isGridClean(this.props.grid)){//reset
          this.setup();
        }
      }
    },

    move: function (direction) {
      //0^, 1>, 2v, 3<
      var self = this;

      if (this.isGameTerminated()) return;

      let cell, tile;

      var vector = this.getVector(direction);
      var traversals = this.buildTraversals(vector);
      let moved = false;

      let grid = this.props.grid;

      this.prepareTiles(grid);
      let newscore = this.props.score;
      let ifwon = this.props.won;
      let ifover = this.props.over;

      traversals.x.forEach(function (x) {
        traversals.y.forEach(function (y) {
          cell = { x: x, y: y };
          tile = grid.cellContent(cell);

          if(tile) {
            var positions = self.findFarthestPosition(cell, vector, grid);
            var next = grid.cellContent(positions.next);
            var mval = self.calculate(tile.value, next, self.props.rule, self.props.objectCode.mode[1]);
            if(!isNaN(mval) && !next.mergedFrom) {
              var merged = new Tile(positions.next, mval);
              merged.mergedFrom = [tile, next];

              grid.insertTile(merged);
              grid.removeTile(tile);

              tile.updatePosition(positions.next);

              newscore += merged.value;

              if (merged.value === self.props.objectCode.goal) ifwon = true;
            } else {//moveTile
              grid.cells[tile.x][tile.y] = null;
              grid.cells[positions.farthest.x][positions.farthest.y] = tile;
              tile.updatePosition(positions.farthest);
            }

            if (!(cell.x === tile.x && cell.y === tile.y)) {//if position has changed
              moved = true;
            }
          }
        });
      });
      
      if(moved) {
        grid.flag = 1;
        this.addRandomTile(grid, this.props.objectCode.seed);
        ifover = !(grid.cellsAvailable() || this.tileMatchesAvailable(grid, this.props.rule, this.props.objectCode.mode[1]));
        this.dispatch({
          grid: grid,
          score: newscore,
          over: ifover,
          won: ifwon,
        });
      }
    },

    getVector: function (direction) {
      var map = {
        0: { x: 0, y: -1 }, //^
        1: { x: 1, y: 0 }, //>
        2: { x: 0, y: 1 }, //v
        3: { x: -1, y: 0 }, //<
      };

      return map[direction];
    },

    buildTraversals: function (vector) {
      var traversals = { x: [], y: [] };

      for (var pos = 0; pos < this.props.objectCode.size; pos++){
        traversals.x.push(pos);
        traversals.y.push(pos);
      }

      if(vector.x === 1) traversals.x = traversals.x.reverse();
      if(vector.y === 1) traversals.y = traversals.y.reverse();

      return traversals;
    },

    findFarthestPosition: function (cell, vector, grid) {
      var previous;

      do {
        previous = cell;
        cell = { x: previous.x + vector.x, y: previous.y + vector.y };
      } while (grid.withinBounds(cell) && grid.cellAvailable(cell));

      return {
        farthest: previous,
        next: cell
      };
    },

    calculate: function (tval, next, rule, any) {
      var ret = undefined;
      if(next){
        var nval = next.value;
        switch(rule){
          case 0://addition
            if(any || tval === nval){ret = tval + nval;}
            break;
          case 1: //multiplication
            if(any || tval === nval){ret = tval * nval;}
            break;
          case 2: //division
            ret = (tval > nval) ? tval / nval : nval / tval;
            if(ret !== Math.floor(ret)){ret = undefined;}
            break;
          case 3: //threes
            if((tval === nval && tval + nval >= 6) || tval + nval === 3){ret = tval + nval;}
            break;//no further checks needed, assuming a proper seed
          case 4: //fibb
            ret = tval + nval;
            var test1 = Math.floor(Math.sqrt(5*ret*ret + 4));//one of these needs to be a perfect square
            var test2 = Math.floor(Math.sqrt(5*ret*ret - 4));//this is the check for if it's a fibonacci number
            if(test1*test1 !== 5*ret*ret + 4 && test2*test2 !== 5*ret*ret - 4){
              ret = undefined;
            }
            break;
        }
      }
      return ret;
    },

    tileMatchesAvailable: function (grid, rule, any) {
      var self = this;
      var tile;

      for (var x = 0; x < this.props.objectCode.size; x++) {
        for (var y = 0; y < this.props.objectCode.size; y++) {
          tile = grid.cellContent({x: x, y: y});

          if(tile) {
            for(var direction = 0; direction < 4; direction++){
              var vector = this.getVector(direction);
              var cell = { x: x + vector.x, y: y + vector.y };

              var other = grid.cellContent(cell);
              if (!isNaN(self.calculate(tile.value, other, rule, any))){
                return true;//can't just check for equality
              }
            }
          }
        }
      }

      return false;
    },

    isGridClean: function (grid) {
      return grid && grid instanceof Grid;//must both exist and BE a Grid
    },

    render: function () {
      var data = this.props.data;
      if(data){
        if(this.isGridClean(this.props.grid)){
          let color = d3.scale.log().base(2)
            .domain([Math.min.apply(Math, data.seed), data.goal])
            .range(data.tilecolor)
            .interpolate(d3.interpolateLab);
          return (
            <div>
              <div style={{'width':data.boardsize+'px'}} className='gcontainer'>
                {data.scorestyle ? <ScoresContainer style={data.scorestyle} score={this.props.score} best={this.props.best || 0} boardsize={data.boardsize} rounding={data.rounding}/> : null}
                {(data.title || data.desc) ? <HeaderContainer title={data.title} desc={data.desc} boardsize={data.boardsize}/> : null}
                <ButtonContainer restart={this.setup} clearBest={this.clearBest} toggle={this.toggle} mode={data.mode} rule={this.props.rule} boardsize={data.boardsize} rounding={data.rounding}/>
              </div><br></br>
              <div style={{'width':data.boardsize+'px'}} className='game-container'>
                <svg width={data.boardsize+'px'} height={data.boardsize+'px'} cursor='default' className='game-container'>
                  <GridContainer size={data.size} boardsize={data.boardsize} spacing={data.spacing} rounding={data.rounding}/>
                  <TileContainer color={color} grid={this.props.grid} size={data.size} boardsize={data.boardsize} spacing={data.spacing} rounding={data.rounding}/>
                  <GameMessage restart={this.setup} keepPlaying={this.keepPlaying} won={this.props.won} over={this.props.over} terminated={this.isGameTerminated()} boardsize={data.boardsize} rounding={data.rounding}/>
                </svg>
              </div>
            </div>
          );
        } else {
          return (
            <div></div>
          );
        }
      } else {
        return (
          <div>"Loading or suffering an error, wait if applicable."</div>
        );
      }
    }
  });
  var HeaderContainer = React.createClass({
    componentDidUpdate: function () {
      var element = d3.select(window.exports.ReactDOM.findDOMNode(this));
      D3Test.drawHeader(element, this.props);
    },

    componentDidMount: function () {
      var element = d3.select(window.exports.ReactDOM.findDOMNode(this));
      D3Test.drawHeader(element, this.props);
    },

    render: function () {
      return (
        <div className="header">
        </div>
      );
    }
  });

  var ScoresContainer = React.createClass({
    shouldComponentUpdate: function (nextProps) {
      return (this.props.score !== nextProps.score);
    },

    componentDidUpdate: function (prevProps) {
      var difference = this.props.score - prevProps.score;
      var element = d3.select(window.exports.ReactDOM.findDOMNode(this));
      element.selectAll('g')
        .remove();
      var loc = D3Test.drawScore(element, this.props);
      if (difference > 0){
        var c = element.select('g');
        D3Test.drawAdd(c, difference, loc);
      }
    },

    componentDidMount: function () {
      var element = d3.select(window.exports.ReactDOM.findDOMNode(this));
      element.selectAll('g')
        .remove();
      D3Test.drawScore(element, this.props);
    },

    render: function () {
      return (
          <svg className='scores-container'>
          </svg>
      );
    }
  });

  var ButtonContainer = React.createClass({
    componentDidUpdate: function () {
      var element = d3.select(window.exports.ReactDOM.findDOMNode(this));
      D3Test.drawButtons(element, this.props);
      if(this.props.mode[0]){
        D3Test.toggleButton(element.select('svg.buttons'), this.props);
      }
    },

    componentDidMount: function () {
      var element = d3.select(window.exports.ReactDOM.findDOMNode(this));
      D3Test.drawButtons(element, this.props);
      if(this.props.mode[0]){
        D3Test.toggleButton(element.select('svg.buttons'), this.props);
      }
    },

    render: function () {
      return (
        <div className='buttons'>
        </div>
      );
    }
  });

  var GridContainer = React.createClass({
    shouldComponentUpdate: function (nextProps) {
      return (this.props !== nextProps);
    },

    componentDidUpdate: function () {
      var element = d3.select(window.exports.ReactDOM.findDOMNode(this));
      D3Test.drawGrid(element, this.props);
    },

    componentDidMount: function () {
      var element = d3.select(window.exports.ReactDOM.findDOMNode(this));
      D3Test.drawGrid(element, this.props);
    },

    render: function () {
      return (
        <g className="grid-container">
        </g>
      )
    }
  });

  var TileContainer = React.createClass({
    componentDidMount: function () {
      if(this.props.grid){
        var element = d3.select(window.exports.ReactDOM.findDOMNode(this));
        element.selectAll('g')
          .remove();
        //update based on the new grid
        var ac = this.props;
        this.props.grid.cells.forEach(function (column) {
          column.forEach(function (cell) {
            if(cell) {
              D3Test.addTile(element, cell, ac);
            }
          });
        });
      }
    },

    shouldComponentUpdate: function (nextProps) {
      if(nextProps.grid && nextProps.grid.flag){
        nextProps.grid.flag = 0;
        return true;
      } else {
        return false;
      }
    },

    componentDidUpdate: function () {
      var element = d3.select(window.exports.ReactDOM.findDOMNode(this));
      element.selectAll('g')
        .remove();
      //update based on the new grid
      var ac = this.props;
      this.props.grid.cells.forEach(function (column) {
        column.forEach(function (cell) {
          if(cell) {
            D3Test.addTile(element, cell, ac);
          }
        });
      });
    },

    render: function () {
      return (
        <g className='tile-container'>
        </g>
      );
    }
  });

  var GameMessage = React.createClass({
    componentDidMount: function () {
      var element = d3.select(window.exports.ReactDOM.findDOMNode(this));
      var ac = this;
      if(this.props.terminated && this.props.won){
        D3Test.endScreen(element, ac.props, false);
      }
    },

    componentDidUpdate: function () {
      var element = d3.select(window.exports.ReactDOM.findDOMNode(this));
      var ac = this;
      element.selectAll('g')
        .remove();
      if(this.props.terminated){
        if(this.props.over){
          D3Test.endScreen(element, ac.props, true);
        } else if (this.props.won){
          D3Test.endScreen(element, ac.props, false);
        }
      }
    },

    render: function () {
      //just handle the logic of whether to display or not and some other things here
      //the buttons should link back to the respective functions on the container
      return (
        <g className='game-message'>
        </g>
      );
    }
  });

  function capture(el) {
  }
  return {
    capture: capture,
    Viewer: Game
  };
})();
