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
          var element = d3.select(ReactDOM.findDOMNode(this));
          //use D3 to draw the background here
          D3Test.drawGrid(element.select('svg.game-container').select('g.grid-container'));
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
          } else if(this.state.grid) {
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
        },

        render: function () {
          /*
            <div className='gcontainer'>
              <div className='heading' display='block'>
                <h1 className='title'>2048</h1>
                <ScoresContainer score={this.state.score} best={this.bestScore()} />
              </div>
              <div className='above-game'>
                <p className='game-intro'>Placeholder text!</p>
                <a className='restart-button' onClick={this.restart}>New Game</a>
              </div>
              <svg width='500px' height='500px' cursor='default' className='game-container'>
                <g className='grid-container'>
                </g>
                <TileContainer grid={this.state.grid} />
                <GameMessage restart={this.restart} keepPlaying={this.keepPlaying} won={this.state.won} over={this.state.over} terminated={this.isGameTerminated()} />
              </svg>
            </div>
          */
          return (
            <div>
              <svg width='500px' className='gcontainer'>
                <g className='heading'>
                  <ScoresContainer score={this.state.score} best={this.bestScore()} />
                </g>
              </svg>
              <svg width='500px' height='500px' cursor='default' className='game-container'>
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
        getInitialState: function () {
          return {score: 0};
        },

        componentDidUpdate: function (prevProps) {
          var difference = prevProps.score - this.props.score;
          var element = d3.select(ReactDOM.findDOMNode(this));
          element.selectAll('g')
            .remove();
          D3Test.drawScore(element, this.props.score || 0, this.props.best || 0);
          if (difference > 0){
            //add a function for the score addition transition
          }
        },

        componentDidMount: function () {
          var element = d3.select(ReactDOM.findDOMNode(this));
          element.selectAll('g')
            .remove();
          D3Test.drawScore(element, this.props.score || 0, this.props.best || 0);
        },

        render: function () {
          /*
              <div className='score-container'>{this.props.score}</div>
              <div className='best-container'>{this.props.best}</div>
          */
          return (
            <g className='scores-container'>
            </g>
          );
        }
      });

      var GameMessage = React.createClass({
        componentDidUpdate: function () {
          var element = d3.select(ReactDOM.findDOMNode(this));
          var ac = this;
          element.selectAll('g')
            .remove();
          if(this.props.terminated){
            var g = element.append('g')
              .attr('opacity', 0);
            g.transition()
              .duration(1200)
              .attr('opacity', 100);
            g.append('rect')
              .attr('width', 500+'px')
              .attr('height', 500+'px')
              .attr('fill', 'rgba(238, 228, 218, 0.73)');
            if(this.props.over){
              //rgba(238, 228, 218, 0.73) for background
              //118 px x 40 px try again button
              g.append('text')
                .attr('x', 250+'px')
                .attr('y', 222+60+'px')
                .attr('fill', '#776e65')
                .attr('text-anchor', 'middle')
                .style('font-weight', 'bold')
                .style('font-family', '"Clear Sans", "Helvetica Neue", Arial, sans-serif')
                .style('font-size', 60+'px')
                .text('Game over!');
              g.append('rect')
                .attr('x', 191+'px')//half board size - width/2
                .attr('y', 353+'px')
                .attr('rx', 3)
                .attr('ry', 3)
                .attr('width', 118+'px')
                .attr('height', 40+'px')
                .attr('fill', '#8f7a66')
                .on("click", function (d){
                  return ac.props.restart();
                });
              g.append('text')
                .attr('x', 250+'px')
                .attr('y', 353+26+'px')
                .attr('fill', '#f9f6f2')
                .attr('text-anchor', 'middle')
                .style('font-family', '"Clear Sans", "Helvetica Neue", Arial, sans-serif')
                .style('font-size', 18+'px')
                .style('font-weight', 'bold')
                .style('cursor', 'default')
                .text('Try again')
                .on("click", function (d){
                  return ac.props.restart();
                });
            } else if (this.props.won){
              //make the restart button
              g.append('text')
                .attr('x', 250+'px')
                .attr('y', 222+60+'px')
                .attr('fill', '#f9f6f2')
                .attr('text-anchor', 'middle')
                .style('font-weight', 'bold')
                .style('font-family', '"Clear Sans", "Helvetica Neue", Arial, sans-serif')
                .style('font-size', 60+'px')
                .text('You won!');
              g.append('rect')
                .attr('x', 129+'px')
                .attr('y', 250+'px')
                .attr('rx', 3)
                .attr('ry', 3)
                .attr('width', 118+'px')
                .attr('height', 40+'px')
                .attr('fill', '#8f7a66')
                .on("click", function (d){
                  return ac.props.restart();
                });
              g.append('text')
                .attr('x', 190+'px')
                .attr('y', 250+26+'px')
                .attr('fill', '#f9f6f2')
                .attr('text-anchor', 'middle')
                .style('font-family', '"Clear Sans", "Helvetica Neue", Arial, sans-serif')
                .style('font-size', 18+'px')
                .style('font-weight', 'bold')
                .style('cursor', 'default')
                .text('Play again')
                .on("click", function (d){
                  return ac.props.restart();
                });
              //make the keep playing button
              g.append('rect')
                .attr('x', 250+'px')
                .attr('y', 250+'px')
                .attr('rx', 3)
                .attr('ry', 3)
                .attr('width', 120+'px')
                .attr('height', 40+'px')
                .attr('fill', '#8f7a66')
                .on("click", function (d){
                  return ac.props.keepPlaying();
                });
              g.append('text')
                .attr('x', 310+'px')
                .attr('y', 250+26+'px')
                .attr('fill', '#f9f6f2')
                .attr('text-anchor', 'middle')
                .style('font-family', '"Clear Sans", "Helvetica Neue", Arial, sans-serif')
                .style('font-size', 18+'px')
                .style('font-weight', 'bold')
                .style('cursor', 'default')
                .text('Keep going')
                .on("click", function (d){
                  return ac.props.keepPlaying();
                });
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
