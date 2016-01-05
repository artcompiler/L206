/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil; tab-width: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
/* Copyright (c) 2015, Jeff Dyer, Art Compiler LLC */
import {assert, message, messages, reserveCodeRange} from "./assert.js";
import {Grid, Tile} from "./grid.js";
import * as React from "react";
import * as D3Test from "./d3Test";
import * as ReactDOM from "react-dom";
window.exports.viewer = (function () {
  function update(el, obj, src, pool) {
    var data = JSON.parse(obj).data;
    let color = d3.scale.log().base(2)
      .domain([Math.min.apply(Math, data.seed), data.goal])
      .range(data.tilecolor)
      .interpolate(d3.interpolateLab);
    if(data.play === true){
      //react stuff starts here
      var Game = React.createClass({
        save: function (st) {
          window.localStorage.setItem("gameState", JSON.stringify(st));
          var bs = window.localStorage.getItem("bestScore");
          if (!bs || st.score > +bs){
            window.localStorage.setItem("bestScore", st.score);
          }
        },

        clearGame: function () {
          window.localStorage.removeItem("gameState");
        },

        gameState: function () {
          var stateJSON = window.localStorage.getItem("gameState");
          return stateJSON ? JSON.parse(stateJSON) : null;
        },

        bestScore: function () {
          return window.localStorage.getItem("bestScore") || 0;
        },

        clearBest: function () {
          window.localStorage.setItem("bestScore", 0);
          this.restart();
        },

        restart: function () {
          this.replaceState(function(previousState, currentProps) {
            return {};
          });
          this.clearGame();
          //clear game won/lost message
          this.setup();
        },

        toggle: function () {
          this.setState(function(previousState, currentProps) {
            var t = ++previousState.rule;
            if(t > 2){
              t = 0;
            }
            return {rule: t};
          });
        },

        keepPlaying: function () {
          this.setState(function(previousState, currentProps) {
           return {keepPlaying: true};
          });
          //clear game won/lost message - setting keepplaying should do this already given update
        },

        isGameTerminated: function () {
          return this.state.over || (this.state.won && !this.state.keepPlaying);
        },

        componentWillMount: function () {
          this.setup();
        },

        setup: function () {
          var prevState = this.gameState();
          if(prevState && prevState.grid){
            this.setState(function(previousState, currentProps) {
              return {
                grid: new Grid(prevState.grid.size, prevState.grid.cells),
                score: prevState.score,
                over: prevState.over,
                won: prevState.won,
                keepPlaying: prevState.keepPlaying,
                rule: prevState.rule,
              };
            });
          } else {
            this.setState(function(previousState, currentProps) {
              return {
                grid: new Grid(currentProps.size),
                score: 0,
                over: false,
                won: false,
                keepPlaying: false,
                rule: currentProps.mode[2],
              };
            });
            this.addStartTiles();
          }
        },

        addStartTiles: function () {
          for (var i = 0; i < this.props.size/2; i++) {
            this.addRandomTile();
          }
        },

        addRandomTile: function () {
          this.setState(function(previousState, currentProps) {
            if(previousState.grid.cellsAvailable()) {
              var value = +this.props.seed[Math.floor(Math.random()*this.props.seed.length)];
              var tile = new Tile(previousState.grid.randomAvailableCell(), value);

              previousState.grid.insertTile(tile);
              return {grid: previousState.grid};
            }
          });
        },

        prepareTiles: function () {
          this.setState(function(previousState, currentProps) {
            previousState.grid.eachCell(function (x, y, tile) {
              if(tile) {
                tile.mergedFrom = null;
                tile.savePosition();
              }
            });
            return {grid: previousState.grid};
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

          if(!modifiers) {
            if (mapped !== undefined) {
              event.preventDefault();
              this.move(mapped);
            } else if(event.which === 82){
              this.restart();
            }
          }

        },

        move: function (direction) {
          //0^, 1>, 2v, 3<
          //we can assume that by the time this runs, we DO have a stable grid state.
          var self = this;

          if (this.isGameTerminated()) return;

          let cell, tile;

          var vector = this.getVector(direction);
          var traversals = this.buildTraversals(vector);
          let moved = false;

          this.prepareTiles();
          this.setState(function (previousState, currentProps) {
            let newscore = previousState.score;
            let ifwon = previousState.won;

            traversals.x.forEach(function (x) {
              traversals.y.forEach(function (y) {
                cell = { x: x, y: y };
                tile = previousState.grid.cellContent(cell);

                if(tile) {
                  var positions = self.findFarthestPosition(cell, vector, previousState.grid);
                  var next = previousState.grid.cellContent(positions.next);
                  var mval = self.calculate(tile.value, next, previousState.rule, currentProps.mode[1]);
                  if(!isNaN(mval) && !next.mergedFrom) {
                    var merged = new Tile(positions.next, mval);
                    merged.mergedFrom = [tile, next];

                    previousState.grid.insertTile(merged);
                    previousState.grid.removeTile(tile);

                    tile.updatePosition(positions.next);

                    newscore += merged.value;

                    if (merged.value === currentProps.goal) ifwon = true;
                  } else {//moveTile
                    previousState.grid.cells[tile.x][tile.y] = null;
                    previousState.grid.cells[positions.farthest.x][positions.farthest.y] = tile;
                    tile.updatePosition(positions.farthest);
                  }

                  if (!(cell.x === tile.x && cell.y === tile.y)) {//if position has changed
                    moved = true;
                  }
                }
              });
            });
            return {grid: previousState.grid, score: newscore, won: ifwon};
          });

          if(moved) {
            this.addRandomTile();
            this.setState(function(previousState, currentProps) {
              if(!(previousState.grid.cellsAvailable() || this.tileMatchesAvailable(previousState.grid, previousState.rule, currentProps.mode[1]))) {
                return {over: true};
              } else return {};
            });
          }
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

        getVector: function (direction) {
          var map = {
            0: { x: 0, y: -1 }, //^
            1: { x: 1, y: 0 }, //>
            2: { x: 0, y: 1 }, //v
            3: { x: -1, y: 0 }, //<
          };

          return map[direction];//make sure you can actually get the input into this form.
        },

        buildTraversals: function (vector) {
          var traversals = { x: [], y: [] };

          for (var pos = 0; pos < this.props.size; pos++){//fill with 0123
            traversals.x.push(pos);
            traversals.y.push(pos);
          }

          if(vector.x === 1) traversals.x = traversals.x.reverse();//fill with 3210 if right
          if(vector.y === 1) traversals.y = traversals.y.reverse();//fill with 3210 if down

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

        tileMatchesAvailable: function (grid, rule, any) {
          var self = this;
          var tile;

          for (var x = 0; x < this.props.size; x++) {
            for (var y = 0; y < this.props.size; y++) {
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

        componentDidMount: function () {
          var element = d3.select(ReactDOM.findDOMNode(this));
          //use D3 to draw the background here
          D3Test.drawGrid(element.select('svg.game-container').select('g.grid-container'), this.props);
          D3Test.drawHeader(element.select('div.gcontainer'), this.restart, this.clearBest, this.props);
          window.addEventListener("keydown", this.handleMove);
          if(this.props.mode[0]){
            D3Test.toggleButton(element.select('div.gcontainer').select('svg.buttons'), this.toggle, isNaN(this.state.rule) ? this.props.mode[2] : this.state.rule);
          }
          /*var heading = element.select('div.gcontainer');
          heading.attr('height', heading.node().getBBox().height + 5);*/
        },

        componentWillUnmount: function () {
          window.removeEventListener("keydown", this.handleMove);
        },

        componentDidUpdate: function () {
          var element = d3.select(ReactDOM.findDOMNode(this));
          if(this.props.mode[0]){
            D3Test.toggleButton(element.select('div.gcontainer').select('svg.buttons'), this.toggle, this.state.rule);
          }
          //use D3 to update the foreground here
          if(this.state.over){
            this.clearGame();
          }
        },

        render: function () {
          if(this.state.grid) {
            this.save(
              {
                grid: this.state.grid.serialize(),
                score: this.state.score,
                over: this.state.over,
                won: this.state.won,
                keepPlaying: this.state.keepPlaying,
                rule: this.state.rule,
              }
            );
          }
          return (
            <div>
              <div style={{'width':this.props.boardsize+'px'}} className='gcontainer'>
                {this.props.score ? <ScoresContainer score={this.state.score} best={this.bestScore()} boardsize={this.props.boardsize}/> : <br></br>}
                <br></br>
              </div><br></br>
              <svg width={this.props.boardsize+'px'} height={this.props.boardsize+'px'} cursor='default' className='game-container'>
                <g className='grid-container'>
                </g>
                <TileContainer grid={this.state.grid} size={this.props.size} boardsize={this.props.boardsize} spacing={this.props.spacing}/>
                <GameMessage restart={this.restart} keepPlaying={this.keepPlaying} won={this.state.won} over={this.state.over} terminated={this.isGameTerminated()} boardsize={this.props.boardsize}/>
              </svg>
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
          var element = d3.select(ReactDOM.findDOMNode(this));
          element.selectAll('g')
            .remove();
          var loc = D3Test.drawScore(element, this.props);
          if (difference > 0){
            //add a function for the score addition transition
            D3Test.drawAdd(element, difference, loc);
          }
        },

        componentDidMount: function () {
          var element = d3.select(ReactDOM.findDOMNode(this));
          element.selectAll('g')
            .remove();
          D3Test.drawScore(element, this.props);
          /*var heading = d3.select('svg.gcontainer');
          heading.attr('height', heading.node().getBBox().height + 5);*/
        },

        render: function () {
          return (
              <svg className='scores-container'>
              </svg>
          );
        }
      });

      var GameMessage = React.createClass({
        componentDidMount: function () {
          var element = d3.select(ReactDOM.findDOMNode(this));
          var ac = this;
          if(this.props.terminated && this.props.won){
            D3Test.endScreen(element, ac.props, false);
          }
        },

        componentDidUpdate: function () {
          var element = d3.select(ReactDOM.findDOMNode(this));
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

      var TileContainer = React.createClass({
        componentDidMount: function () {
          if(this.props.grid){
            var element = d3.select(ReactDOM.findDOMNode(this));
            element.selectAll('g')
              .remove();
            //update based on the new grid
            var ac = this.props;
            this.props.grid.cells.forEach(function (column) {
              column.forEach(function (cell) {
                if(cell) {
                  D3Test.addTile(element, cell, ac, color);
                }
              });
            });
          }
        },

        shouldComponentUpdate: function (nextProps) {
          if(nextProps.grid){
            return true;
          } else {
            return false;
          }
        },

        componentDidUpdate: function () {
          var element = d3.select(ReactDOM.findDOMNode(this));
          element.selectAll('g')
            .remove();
          //update based on the new grid
          var ac = this.props;
          this.props.grid.cells.forEach(function (column) {
            column.forEach(function (cell) {
              if(cell) {
                D3Test.addTile(element, cell, ac, color);
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
      ReactDOM.render(
        <Game
          boardsize={+data.size}
          size={+data.grid}
          spacing={+data.spacing}
          seed={data.seed}
          goal={+data.goal}
          mode={data.mode}
          title={data.title}
          description={data.description}
          score={data.score}/>,
        document.getElementById("graff-view")
      );
    }
    return;
  }
  function capture(el) {
  }
  return {
    update: update,
    capture: capture,
  };
})();
