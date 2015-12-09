/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil; tab-width: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
/* Copyright (c) 2015, Jeff Dyer, Art Compiler LLC */
import {assert, message, messages, reserveCodeRange} from "./assert.js";
import {Grid, Tile} from "./grid.js";
import * as React from "react";
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
          };
        },

        restart: function () {
          this.replaceState({best: this.state.best});
          //clear game won/lost message
          this.setup();
        },

        keepPlaying: function () {
          this.setState({keepPlaying: true});
          //clear game won/lost message - setting keepplaying should do this already given update
        },

        isGameTerminated: function () {
          return this.state.over || (this.state.won && !this.state.keepPlaying);
        },

        componentWillMount: function () {
          this.setup();
        },

        setup: function () {
          //put a check for previous and saved state here
          //if that check finds nothing,
          this.setState(function(previousState, currentProps) {
            return {
              grid: new Grid(currentProps.size),
              score: 0,
              over: false,
              won: false,
              keepPlaying: false,
            }
          });
          this.addStartTiles();
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
            75: 0, // Vim up
            76: 1, // Vim right
            74: 2, // Vim down
            72: 3, // Vim left
            87: 0, // W
            68: 1, // D
            83: 2, // S
            65: 3  // A
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

          traversals.x.forEach(function (x) {
            traversals.y.forEach(function (y) {
              self.setState(function(previousState, currentProps) {
                var newscore = previousState.score;
                var ifwon = previousState.won;
                cell = { x: x, y: y };
                tile = previousState.grid.cellContent(cell);

                if(tile) {
                  var positions = this.findFarthestPosition(cell, vector, previousState.grid);
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
                return {grid: previousState.grid, score: newscore, won: ifwon};
              });
            });
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
          var element = ReactDOM.findDOMNode(this);
          //use D3 to draw the background here
          //var element = d3.select(ReactDOM.findDOMNode(this));
          window.addEventListener("keydown", this.handleMove);
          console.log(this.state.grid);
        },

        componentWillUnmount: function () {
          window.removeEventListener("keydown", this.handleMove);
        },

        componentDidUpdate: function () {
          if (this.state.best < this.state.score){
            this.setState({best: this.state.score});
          }
          var element = ReactDOM.findDOMNode(this);
          //use D3 to update the foreground here
          console.log(this.state.grid);
        },

        render: function () {
          //<GameMessage over={this.state.over} won={this.state.won} keepPlaying={this.state.keepPlaying} />
          return (
            <div className='gcontainer'>
              <div className='heading' display='block'>
                <h1 className='title'>2048</h1>
                <ScoresContainer score={this.state.score} best={this.state.best} />
              </div>
              <div className='above-game'>
                <p className='game-intro'>Placeholder text!</p>
                <a className='restart-button' onClick={this.restart}>New Game</a>
              </div>
              <div className='game-container'>
                <div className='grid-container'>
                <TileContainer grid={this.state.grid} />
                </div>
              </div>
            </div>
          );
        }
      });

      var ScoresContainer = React.createClass({
        render: function () {
          //do the thing with the addition thing here
          return (
            <div className='scores-container'>
              <div className='score-container'>{this.props.score}</div>
              <div className='best-container'>{this.props.best}</div>
            </div>
          );
        }
      });

      var GameMessage = React.createClass({
        render: function () {
          //just handle the logic of whether to display or not and some other things here
          //the buttons should link back to the respective functions on the container
          return (
            <div className='game-message'>
              <p></p>
              <div className='lower'>
                <a className='keep-playing-button'>Keep going</a>
                <a className='retry-button'>Try again</a>
              </div>
            </div>
          );
        }
      });

      var TileContainer = React.createClass({
        render: function () {
          //decidedly the most involved, but it shouldn't be difficult to make the tiles appear properly.
          return (
            <div className='tile-container'>
            </div>
          );
        }
      });

      ReactDOM.render(
        <Game/>,
        document.getElementById("graff-view")
      );
      /*var ReactExample = React.createClass({
        componentDidMount: function () {
          var element = ReactDOM.findDOMNode(this);
          d3Test.create(element, {
            width: '100%',
            height: '30px'
          });
          this.refs.testing.testing();
        },
        componentDidUpdate: function () {
          var element = ReactDOM.findDOMNode(this);
          //run d3 update functions here
        },
        componentWillUnmount: function () {
          var element = ReactDOM.findDOMNode(this);
          //run d3 destruction functions here
        },
        handleClick: function() {
          console.log('Click test successful');
        },
        render: function() {

          return (
            <div className="D3test">
              <ReactTest clt={this.handleClick} ref={'testing'}/>
            </div>
          );
        }
      });
      var ReactTest = React.createClass({
        componentDidMount: function () {
          var element = ReactDOM.findDOMNode(this);
          d3Test.create(element, {
            width: '30px',
            height: '60px'
          });
          this.props.clt();
        },

        testing: function () {
          console.log("Test successful");
        },

        render: function () {
          return (
            <div className = "Childtest"></div>
          );
        }
      });
      ReactDOM.render(
        <ReactExample/>,
        document.getElementById("graff-view")
      );*/
      //react stuff ends here
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
