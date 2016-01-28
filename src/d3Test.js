/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil; tab-width: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
/* Copyright (c) 2015, Jeff Dyer, Art Compiler LLC */

//let round = 3;
let font = '"Clear Sans", "Helvetica Neue", Arial, sans-serif';

let drawGrid = function (svg, props) {
  svg.selectAll('rect')
    .remove();
  var tilesize = (props.boardsize - props.spacing*(props.size+1))/props.size;
  svg.append('rect')
    .attr('rx', props.style.rounding*2)
    .attr('ry', props.style.rounding*2)
    .attr('width', props.boardsize+'px')
    .attr('height', props.boardsize+'px')
    .attr('fill', props.style.background);
  for(var x=0; x < props.size; x++){
    for(var y=0; y < props.size; y++){
      svg.append('rect')
        .attr('rx', props.style.rounding)
        .attr('ry', props.style.rounding)
        .attr('width', tilesize+'px')
        .attr('height', tilesize+'px')
        .attr('x', (props.spacing+(x*(tilesize+props.spacing))))
        .attr('y', (props.spacing+(y*(tilesize+props.spacing))))
        .attr('fill', props.style.foreground);
    }
  }
};

//width and height of 107px
//border radius 3 pixels
//font size 55px, bold, center
//translate by 121 pixels (size + 14) per square
let addTile = function (svg, tile, props) {
  var tilesize = (props.boardsize - props.spacing*(props.size+1))/props.size;
  var position = tile.previousPosition || { x: tile.x, y: tile.y };

  //if >8 use #776e65 else use #f9f6f2
  if(tile.previousPosition){
    var t = svg.append('g')
      .attr("transform", 'translate('+(props.spacing+position.x*(tilesize+props.spacing))+','+(props.spacing+position.y*(tilesize+props.spacing))+')');
    t.transition()
      .duration(100)
      .attr("transform", 'translate('+(props.spacing+tile.x*(tilesize+props.spacing))+','+(props.spacing+tile.y*(tilesize+props.spacing))+')');
  } else {
    if(tile.mergedFrom){
      tile.mergedFrom.forEach(function (merged) {
        addTile(svg, merged, props);
      });
    }
    var t = svg.append('g')
      .attr("transform", 'translate('+(props.spacing+position.x*(tilesize+props.spacing) + tilesize/2)+','+(props.spacing+position.y*(tilesize+props.spacing) + tilesize/2)+') scale(0, 0)');
    t.transition()
      .duration(100)
      .attr("transform", 'translate('+(props.spacing+position.x*(tilesize+props.spacing))+','+(props.spacing+position.y*(tilesize+props.spacing))+')');
  }
  t.append('rect')
    .attr('rx', props.style.rounding)
    .attr('ry', props.style.rounding)
    .attr('width', tilesize+'px')
    .attr('height', tilesize+'px')
    .attr('fill', props.color(tile.value) || '#3c3a32');
//65 -> 77, 55 -> 66, 45 -> 54, 35 -> 42
//adds 12, adds 11, adds 9, adds 7
//55/5 = 11, 45/5 = 9, 35/5 = 7, 65/5 = 13 close enough.
  var fontsize = 55-(10*(tile.value.toString().length-2));
  var scale = tilesize/106.25;
  var rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(props.color(tile.value));
  var l = 0.2126*(parseInt(rgb[1], 16)) + 0.7152*(parseInt(rgb[2], 16)) + 0.0722*(parseInt(rgb[3], 16));
  t.append('text')
    .attr('x', (tilesize/2)/scale + 'px')
    .attr('y', (tilesize/2)/scale + 'px')
    .attr('fill', props.style.tilecolor || (l>215) ? '#776e65' : '#f9f6f2')
    .attr('text-anchor', 'middle')
    .attr('alignment-baseline', 'central')
    .attr("transform", 'scale('+scale+', '+scale+')')
    .style('font-family', props.style['font-family'] || font)
    .style('cursor', 'default')
    .style('font-size', props.style['font-size'] || fontsize+'px')
    .style('font-weight', props.style['font-weight'] || 'bold')
    .style('text-decoration', props.style['text-decoration'] || 'none')
    .text(tile.value);

  //set up a transition from previousPosition to current position for tiles that have it
  //set up a transition to fade in for new tiles
  //figure out what to do about merged tiles
};

let drawAdd = function (svg, diff, loc, props) {
  //font-size 25px, bold, rgba(119, 110, 101, 0.9), 600ms, think it starts where score is
  svg.append('text')
    .attr('x', loc+'px')
    .attr('y', 50+'px')
    .attr('fill', props.style['add-color'] || 'rgba(119, 110, 101, 0.9)')
    .attr('text-anchor', 'middle')
    .attr('opacity', 1)
    .style('font-family', props.style['font-family'] || font)
    .style('font-size', props.style['font-size'] || 25+'px')
    .style('font-weight', props.style['font-weight'] || 'bold')
    .style('font-style', props.style['font-style'] || 'normal')
    .style('text-decoration', props.style['text-decoration'] || 'none')
    .text('+'+diff)
    .transition()
      .duration(600)
      .attr('opacity', 0)
      .attr('y', 0)
      .remove();
};

let drawScore = function (svg, props) {
  var g = svg.append('g');
  //1 digit: 15.625, 2: 30.328, 3: 45.031, 4: 60
  //25 on each side, height 55
  //font-size 13px, color #eee4da
  var p = 1;
  if(props.boardsize < 500){
    p = props.boardsize/500;
  }
  var rec = g.append('rect')
    .attr('fill', props.style.background || '#bbada0')
    .attr('rx', props.style.rounding || 3)//props.style must exist or score won't be drawn
    .attr('ry', props.style.rounding || 3);//props.style.rounding may not exist, though.
  var rec2 = g.append('rect')
    .attr('fill', props.style.background || '#bbada0')
    .attr('rx', props.style.rounding || 3)
    .attr('ry', props.style.rounding || 3);
  var tex = g.append('text')
    .attr('text-anchor', 'middle')
    .attr('fill', props.style['font-color'] || props.style['color'] || props.style['fill'] || 'white')
    .style('font-family', props.style['font-family'] || font)
    .style('font-size', props.style['font-size'] || 25+'px')
    .style('font-weight', props.style['font-weight'] || 'bold')
    .style('font-style', props.style['font-style'] || 'normal')
    .style('text-decoration', props.style['text-decoration'] || 'none')
    .text(props.best);
  var tb = tex.node().getBBox();
  var tex2 = g.append('text')
    .attr('text-anchor', 'middle')
    .attr('fill', props.style['font-color'] || props.style['color'] || props.style['fill'] || 'white')
    .style('font-family', props.style['font-family'] || font)
    .style('font-size', props.style['font-size'] || 25+'px')
    .style('font-weight', props.style['font-weight'] || 'bold')
    .style('font-style', props.style['font-style'] || 'normal')
    .style('text-decoration', props.style['text-decoration'] || 'none')
    .text(props.score);
  var ts = tex2.node().getBBox();
  rec
    .attr('x', 10*p + (50*p + ts.width) + 'px')
    .attr('height', tb.height + 26*p + 'px')
    .attr('width', 50*p + tb.width + 'px');
  tex
    .attr('x', (50*p + tb.width)/2 + 10*p + (50*p + ts.width) + 'px')
    .attr('y', tb.height + 21*p + 'px');
  g.append('text')
    .attr('x', (50*p + tb.width)/2 + 10*p + (50*p + ts.width) + 'px')
    .attr('y', 20*p+'px')
    .attr('text-anchor', 'middle')
    .attr('fill', props.style['label-color'] || '#eee4da')
    .style('font-family', props.style['font-family'] || font)
    .style('font-size', 13*p+'px')
    .text('BEST');
  rec2
    .attr('x', 0 + 'px')
    .attr('height', tb.height + 26*p + 'px')
    .attr('width', 50*p + ts.width + 'px');
  tex2
    .attr('x', (50*p + ts.width)/2 + 'px')
    .attr('y', tb.height + 21*p + 'px');
  g.append('text')
    .attr('x', (50*p + ts.width)/2 + 'px')
    .attr('y', 20*p+'px')
    .attr('text-anchor', 'middle')
    .attr('fill', props.style['label-color'] || '#eee4da')
    .style('font-family',  props.style['font-family'] || font)
    .style('font-size', 13*p+'px')
    .text('SCORE');
  svg
    .attr('x', props.boardsize - (50*p + tb.width) - 10*p - (50*p + ts.width)+'px')
    .attr('width', g.node().getBBox().width)
    .attr('height', g.node().getBBox().height + 10*p)
    .style('float', 'right')
    .style('text-align', 'right');

  return ((50 + ts.width)/2);//score position
};

let drawHeader = function (div, props) {
  if(props.title && props.title.label){
    div.selectAll('h1')
      .remove();
    var head = div.insert('h1', 'br')
      .style('color', props.title['font-color'] || props.title['color'] || props.title['fill'] || '#776e65')
      .style('font-family', props.title['font-family'] || font)
      .style('font-weight', props.title['font-weight'] || 'bold')
      .style('font-size', props.title['font-size'] || 80+'px')
      .style('font-style', props.title['font-style'] || 'normal')
      .style('text-decoration', props.title['text-decoration'] || 'none')
      .style('float', 'left')
      .style('display', 'block')
      .style('margin-bottom', 20+'px')
      .text(props.title.label);
  }
  if(props.desc && props.desc.label){
    div.selectAll('p')
      .remove();
    var des = div.insert('p', 'br')
      .attr('align', 'left')
      .style('color', props.desc['font-color'] || props.desc['color'] || props.desc['fill'] || '#776e65')
      .style('font-family', props.desc['font-family'] || font)
      .style('font-weight', props.desc['font-weight'] || 'normal')
      .style('font-size', props.desc['font-size'] || 18+'px')
      .style('font-style', props.desc['font-style'] || 'normal')
      .style('text-decoration', props.desc['text-decoration'] || 'none')
      .style('float', props.title ? 'left' : 'none')
      .style('display', 'block')
      .style('width', props.boardsize)
      .text(props.desc.label);
  }
};

let drawButtons = function (div, props){
  div.selectAll('svg')
    .remove();
  var svg = div.append('svg').attr('class', 'buttons');
  var g = svg.append('g');

  var rec = g.append('rect')
    .attr('rx', props.style.rounding || 3)
    .attr('ry', props.style.rounding || 3)
    .attr('fill', props.style.background || '#8f7a66')
    .style('cursor', 'pointer')
    .on('click', function(d){
      return props.restart();
    });

  var tex1 = g.append('text')
    .attr('text-anchor', 'middle')
    .attr('alignment-baseline', 'central')
    .attr('fill', props.style['font-color'] || '#f9f6f2')
    .style('font-family', props.style['font-family'] || font)
    .style('font-size', props.style['font-size'] || 18+'px')
    .style('font-weight', props.style['font-weight'] || 'bold')
    .style('font-style', props.style['font-style'] || 'normal')
    .style('text-decoration', props.style['text-decoration'] || 'none')
    .style('cursor', 'pointer')
    .text('New Game')
    .on('click', function(d){
      return props.restart();
    });

  var tb = tex1.node().getBBox();

  rec
    .attr('width', 10+tb.width)
    .attr('height', 18+tb.height);

  tex1
    .attr('x', (10+tb.width)/2)
    .attr('y', (18+tb.height)/2);

  svg
    .attr('width', props.boardsize)
    .attr('height', g.node().getBBox().height*1.1)
    .style('float', 'right')
    .style('display', 'block');
  if(props.boardsize < 500){
    var p = props.boardsize/500;
    g
      .attr('transform', 'scale('+p+','+p+')');
    svg
      .attr('height', g.node().getBBox().height*1.1*p);
  }
  return (10+tb.width);
};

let toggleButton = function (svg, props, width){
  var t = props.toggle;
  var rule = isNaN(props.rule) ? props.mode[2] : props.rule;
  //Add is 0, Mult is 1, Div is 2

  var rec = svg.append('rect')
    .attr('rx', props.style.rounding || 3)
    .attr('ry', props.style.rounding || 3)
    .attr('fill', (rule === 0) ? (props.style['color-selected'] || '#5C4733') : (props.style.background || '#8f7a66'))
    .style('cursor', 'pointer')
    .on('click', function(d){
      if(rule != 0){
        return t(0);
      } else return null;
    });

  var tex1 = svg.append('text')
    .attr('text-anchor', 'middle')
    .attr('alignment-baseline', 'central')
    .attr('fill', props.style['font-color'] || '#f9f6f2')
    .style('font-family', props.style['font-family'] || font)
    .style('font-size', props.style['font-size'] || 18+'px')
    .style('font-weight', props.style['font-weight'] || 'bold')
    .style('font-style', props.style['font-style'] || 'normal')
    .style('text-decoration', props.style['text-decoration'] || 'none')
    .style('cursor', 'pointer')
    .text('Add')
    .on('click', function(d){
      if(rule != 0){
        return t(0);
      } else return null;
    });

  var tb = tex1.node().getBBox();

  rec
    .attr('x', width + 5)
    .attr('width', 10+tb.width)
    .attr('height', 18+tb.height);

  tex1
    .attr('x', (width + 5) + (10+tb.width)/2)
    .attr('y', (18+tb.height)/2);

  var running = width + 20 + tb.width;

  svg.append('rect')
    .attr('x', running)
    .attr('width', 10+tb.width)
    .attr('height', 18+tb.height)
    .attr('rx', props.style.rounding || 3)
    .attr('ry', props.style.rounding || 3)
    .attr('fill', (rule === 1) ? (props.style['color-selected'] || '#5C4733') : (props.style.background || '#8f7a66'))
    .style('cursor', 'pointer')
    .on('click', function(d){
      if(rule != 1){
        return t(1);
      } else return null;
    });

  svg.append('text')
    .attr('x', running + (10+tb.width)/2)
    .attr('y', (18+tb.height)/2)
    .attr('text-anchor', 'middle')
    .attr('alignment-baseline', 'central')
    .attr('fill', props.style['font-color'] || '#f9f6f2')
    .style('font-family', props.style['font-family'] || font)
    .style('font-size', props.style['font-size'] || 18+'px')
    .style('font-weight', props.style['font-weight'] || 'bold')
    .style('font-style', props.style['font-style'] || 'normal')
    .style('text-decoration', props.style['text-decoration'] || 'none')
    .style('cursor', 'pointer')
    .text('Mul')
    .on('click', function(d){
      if(rule != 1){
        return t(1);
      } else return null;
  });

  running += 15 + tb.width;

  svg.append('rect')
    .attr('x', running)
    .attr('width', 10+tb.width)
    .attr('height', 18+tb.height)
    .attr('rx', props.style.rounding || 3)
    .attr('ry', props.style.rounding || 3)
    .attr('fill', (rule === 2) ? (props.style['color-selected'] || '#5C4733') : (props.style.background || '#8f7a66'))
    .style('cursor', 'pointer')
    .on('click', function(d){
      if(rule != 2){
        return t(2);
      } else return null;
    });

  svg.append('text')
    .attr('x', running + (10+tb.width)/2)
    .attr('y', (18+tb.height)/2)
    .attr('text-anchor', 'middle')
    .attr('alignment-baseline', 'central')
    .attr('fill', props.style['font-color'] || '#f9f6f2')
    .style('font-family', props.style['font-family'] || font)
    .style('font-size', props.style['font-size'] || 18+'px')
    .style('font-weight', props.style['font-weight'] || 'bold')
    .style('font-style', props.style['font-style'] || 'normal')
    .style('text-decoration', props.style['text-decoration'] || 'none')
    .style('cursor', 'pointer')
    .text('Div')
    .on('click', function(d){
      if(rule != 2){
        return t(2);
      } else return null;
  });
};

let endScreen = function (svg, props, lose) {
  var boardsize = props.boardsize;
  var scale = boardsize/500;
  var g = svg.append('g')
    .attr('opacity', 0)
    .attr('transform', 'scale('+scale+','+scale+')');
  g.transition()
    .duration(1200)
    .attr('opacity', 100);
  g.append('rect')
    .attr('width', boardsize/scale+'px')
    .attr('height', boardsize/scale+'px')
    .attr('fill', 'rgba(238, 228, 218, 0.73)');
  if(lose){
    g.append('text')
      .attr('x', boardsize/(2*scale)+'px')
      .attr('y', boardsize/(2*scale)+'px')
      .attr('fill', '#776e65')
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'central')
      .style('font-weight', 'bold')
      .style('font-family', font)
      .style('font-size', 60+'px')
      .text('Game over!');
    g.append('rect')
      .attr('x', 191+'px')//half board size - width/2
      .attr('y', 353+'px')
      .attr('rx', props.rounding)
      .attr('ry', props.rounding)
      .attr('width', 118+'px')
      .attr('height', 40+'px')
      .attr('fill', '#8f7a66')
      .on("click", function (d){
        return props.restart();
      });
    g.append('text')
      .attr('x', boardsize/(2*scale)+'px')
      .attr('y', 353+26+'px')
      .attr('fill', '#f9f6f2')
      .attr('text-anchor', 'middle')
      .style('font-family', font)
      .style('font-size', 18+'px')
      .style('font-weight', 'bold')
      .style('cursor', 'default')
      .text('Try again')
      .on("click", function (d){
        return props.restart();
      });
  } else {
    g.append('text')
      .attr('x', boardsize/(2*scale)+'px')
      .attr('y', boardsize/(2*scale)+'px')
      .attr('fill', '#f9f6f2')
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'central')
      .style('font-weight', 'bold')
      .style('font-family', font)
      .style('font-size', 60+'px')
      .text('You won!');
    g.append('rect')
      .attr('x', 129+'px')
      .attr('y', 353+'px')
      .attr('rx', props.rounding)
      .attr('ry', props.rounding)
      .attr('width', 118+'px')
      .attr('height', 40+'px')
      .attr('fill', '#8f7a66')
      .on("click", function (d){
        return props.restart();
      });
    g.append('text')
      .attr('x', 190+'px')
      .attr('y', 379+'px')
      .attr('fill', '#f9f6f2')
      .attr('text-anchor', 'middle')
      .style('font-family', font)
      .style('font-size', 18+'px')
      .style('font-weight', 'bold')
      .style('cursor', 'default')
      .text('Play again')
      .on("click", function (d){
        return props.restart();
      });

    g.append('rect')
      .attr('x', 252+'px')
      .attr('y', 353+'px')
      .attr('rx', props.rounding)
      .attr('ry', props.rounding)
      .attr('width', 120+'px')
      .attr('height', 40+'px')
      .attr('fill', '#8f7a66')
      .on("click", function (d){
        return props.keepPlaying();
      });
    g.append('text')
      .attr('x', 310+'px')
      .attr('y', 379+'px')
      .attr('fill', '#f9f6f2')
      .attr('text-anchor', 'middle')
      .style('font-family', font)
      .style('font-size', 18+'px')
      .style('font-weight', 'bold')
      .style('cursor', 'default')
      .text('Keep going')
      .on("click", function (d){
        return props.keepPlaying();
      });
  }
};

export {
  drawGrid,
  addTile,
  drawScore,
  drawHeader,
  endScreen,
  drawAdd,
  drawButtons,
  toggleButton,
}
