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
    if(data === true){
      //react stuff starts here
      var Game = React.createClass({
        getDefaultProps: function () {
          return {
            size: 4,
            startTiles: 2,
            boardsize: 500,
          };
        },

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

        restart: function () {
          this.replaceState(function(previousState, currentProps) {
            return {};
          });
          this.clearGame();
          //clear game won/lost message
          this.setup();
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
                keepPlaying: prevState.keepPlaying
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
              };
            });
            this.addStartTiles();
          }
        },

        addStartTiles: function () {
          for (var i = 0; i < this.props.startTiles; i++) {
            this.addRandomTile();
          }
        },

        addRandomTile: function () {
          this.setState(function(previousState, currentProps) {
            if(previousState.grid.cellsAvailable()) {
              var value = Math.random() < 0.9 ? 2 : 4;
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

                  if(next && next.value === tile.value && !next.mergedFrom) {
                    var merged = new Tile(positions.next, tile.value*2);
                    merged.mergedFrom = [tile, next];

                    previousState.grid.insertTile(merged);
                    previousState.grid.removeTile(tile);

                    tile.updatePosition(positions.next);

                    newscore += merged.value;

                    if (merged.value === 2048) ifwon = true;
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
              if(!(previousState.grid.cellsAvailable() || this.tileMatchesAvailable(previousState.grid))) {
                return {over: true};
              } else return {};
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

        tileMatchesAvailable: function (grid) {
          var tile;

          for (var x = 0; x < this.props.size; x++) {
            for (var y = 0; y < this.props.size; y++) {
              tile = grid.cellContent({x: x, y: y});

              if(tile) {
                for(var direction = 0; direction < 4; direction++){
                  var vector = this.getVector(direction);
                  var cell = { x: x + vector.x, y: y + vector.y };

                  var other = grid.cellContent(cell);

                  if (other && other.value === tile.value) {
                    return true;
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
          D3Test.drawGrid(element.select('svg.game-container').select('g.grid-container'), this.props.size);
          D3Test.drawHeader(element.select('svg.gcontainer').select('g.heading'), this.restart);
          window.addEventListener("keydown", this.handleMove);
          this.save(
            {
              grid: this.state.grid.serialize(),
              score: this.state.score,
              over: this.state.over,
              won: this.state.won,
              keepPlaying: this.state.keepPlaying,
            }
          );

        },

        componentWillUnmount: function () {
          window.removeEventListener("keydown", this.handleMove);
        },

        componentDidUpdate: function () {
          var element = ReactDOM.findDOMNode(this);
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
              }
            );
          }
          return (
            <div>
              <svg width={this.props.boardsize+'px'} className='gcontainer'>
                <g className='heading'>
                  <ScoresContainer score={this.state.score} best={this.bestScore()} />
                </g>
              </svg><br></br>
              <svg width={this.props.boardsize+'px'} height={this.props.boardsize+'px'} cursor='default' className='game-container'>
                <g className='grid-container'>
                </g>
                <TileContainer grid={this.state.grid} />
                <GameMessage restart={this.restart} keepPlaying={this.keepPlaying} won={this.state.won} over={this.state.over} terminated={this.isGameTerminated()} />
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
          var loc = D3Test.drawScore(element, this.props.score || 0, this.props.best || 0);
          if (difference > 0){
            //add a function for the score addition transition
            D3Test.drawAdd(element, difference, loc);
          }
        },

        componentDidMount: function () {
          var element = d3.select(ReactDOM.findDOMNode(this));
          element.selectAll('g')
            .remove();
          D3Test.drawScore(element, this.props.score || 0, this.props.best || 0);
        },

        render: function () {
          return (
            <g className='scores-container'>
            </g>
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
            this.props.grid.cells.forEach(function (column) {
              column.forEach(function (cell) {
                if(cell) {
                  D3Test.addTile(element, cell);
                }
              });
            });
          }
        },

        shouldComponentUpdate: function (nextProps) {
          if(nextProps.grid && this.props !== nextProps){
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
          this.props.grid.cells.forEach(function (column) {
            column.forEach(function (cell) {
              if(cell) {
                D3Test.addTile(element, cell);
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
        <Game/>,
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
