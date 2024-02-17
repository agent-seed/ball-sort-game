let N = 6;      // number of full containers / colors
let K = 2;      // number of empty contantars
let H = 5;      // max height (items) of each containers
let C = N + K;  // number of containers (empty + full)

/* Generic functions ------------------------------------------------------------------------- */
function randomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// from: https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
function shuffle(array) {
  let currentIndex = array.length,  randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex > 0) {

    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}

// from: https://stackoverflow.com/a/39838921
function toMatrix(arr, width) {
    return arr.reduce(function (rows, key, index) { 
      return (index % width == 0 ? rows.push([key]) 
        : rows[rows.length-1].push(key)) && rows;
    }, []);
}

function deepCopyMatrix(matrix) {
    return matrix.map(function (arrRow) { 
      return [...arrRow];
    });
}

function arrayEqualItems(array){
    return array.every((itm, idx, arr) => itm === arr[0]);
}

/* Game object, which has C containers and N*H items within them ---------------------------- */

function Game(){

    // Note: the resulting table is not guaranteed to be solvable
    // TODO, add a function to check this
    // TODO, also, initialize the seed to get different levels

    // Create an array of H consecutive equal elements of value i,
    // and concatenate them, using i=0,1,...N
    // Each 'i' represent a different color
    let allItemsArray = [];
    for (let i=0; i<N; i++){
        allItemsArray.push(...Array(H).fill(i));
    }

    // Shuffle this array after
    shuffle(allItemsArray);

    // Convert the 1d array to a 2d array of N items of size H
    this.table = toMatrix(allItemsArray, H);

    // Append K empty containers
    for (let i=0; i<K; i++){
        this.table.push([]);
    }

    // Save the initial table
    this.initialTable  =  deepCopyMatrix(this.table);

}


Game.prototype.makeMove = function(fromIdx,toIdx){
    // this returns 'false' if the move is not performed, 'true' otherwise

    // get the number of items in the two containers
    let fromN = this.table[fromIdx].length;
    let toN   = this.table[toIdx].length

    let strTmp = `${fromIdx}>${toIdx} : [${this.table[fromIdx]}] > [${this.table[toIdx]}]`; // debug
    
    // the move is not allowed if:
    // 1) source and destination coincide, or
    // 2) the source is empty, or
    // 3) the destination is full,
    // 4) the destination is not empty, but the color (id) of the top items in the source 
    //    and destination do not match
    if (fromIdx == toIdx || fromN == 0 || toN == H
            || (toN > 0 && this.table[fromIdx][fromN-1] != this.table[toIdx][toN-1]) ){
        console.log(strTmp,` ---> no move`); // debug
        return false;
    }
 
    // move allowed: do it
    this.table[toIdx].push(this.table[fromIdx].pop());
   
    console.log(strTmp,` ---> [${this.table[fromIdx]}] > [${this.table[toIdx]}]`); // debug
 
    
    // this.makeMoveReverse(toIdx,fromIdx);  // debug
    // this.table[toIdx].push(this.table[fromIdx].pop());  // debug


    return true;
 };
 
 Game.prototype.makeMoveReverse = function(fromIdx,toIdx){
    // this returns 'false' if the reverse move is not performed, 'true' otherwise
    // Note: the direct move is A-->B, the reverse move is B-->A and undo the direct one

    // get the number of items in the two containers
    let fromN = this.table[fromIdx].length;
    let toN   = this.table[toIdx].length

    let strTmp = `*${fromIdx}>${toIdx} : [${this.table[fromIdx]}] > [${this.table[toIdx]}]`; // debug

    // the reverse move is not allowed if:
    // 1) source and destination coincide, or
    // 2) the source is empty, or
    // 3) the destination is full,
    // 4) the source is not empty, but the color (id) of the two top items in the source 
    //    do not match
    if (fromIdx == toIdx || fromN == 0 || toN == H
        || (fromN>1 && this.table[fromIdx][fromN-1] != this.table[fromIdx][fromN-2]) ){
        console.log(strTmp,` ---> no move`); // debug
        return false;
    }

    // reverse move allowed: do it
    this.table[toIdx].push(this.table[fromIdx].pop());
   
    console.log(strTmp,` ---> [${this.table[fromIdx]}] > [${this.table[toIdx]}]`); // debug
    
    // this.table.makeMove(toIdx,fromIdx);  // debug
    // this.table[toIdx].push(this.table[fromIdx].pop());  // debug
 
    return true;
 };
 
 Game.prototype.isSolved = function(){
    // The game is solved if:
    // all the columns are either empty or full with equal items
    // i.e, the number of such columns is C = N+K

    return this.table.filter((container) => (container.length==0
        || (container.length==H && arrayEqualItems(container))
        )).length == C;
 }



// test and debug ----------------------------------------------
//let game = new Game();

// console.table(game.initialTable);
// console.table(game.table);

// game.makeMove(0,2);
// game.makeMove(2,2);
// game.makeMove(6,3);
// game.makeMove(0,6);
// game.makeMove(0,6);
// game.makeMove(1,6);
// game.makeMove(0,1);

// console.table(game.initialTable);
// console.table(game.table);

// console.log(game.isSolved());

// // set table as the final configuration to test the isSolved method
// game.table = [];
// for (let i=0; i<N; i++){
//     game.table.push(Array(H).fill(i));
// }
// // append the empty containers
// for (let i=0; i<K; i++){
//     game.table.push([]);
// }
// // shuffle it
// shuffle(game.table);
// // test the function
// console.log(game.isSolved());
// -------------------------------------------------------------


/* || User Interface */

// List of 20 Simple, Distinct Colors, from https://sashamaps.net/docs/resources/20-colors/
let colors=['#e6194B', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4', '#469990', '#dcbeff', '#9A6324', '#fffac8', '#800000', '#aaffc3', '#808000', '#ffd8b1', '#000075', '#a9a9a9'];

function initItemsColorsCSSClasses(){
    // create CSS rule for the color of each item
    // see https://stackoverflow.com/questions/1720320/how-to-dynamically-create-css-class-in-javascript-and-apply

    let head = document.getElementsByTagName('head')[0];
    let style = document.createElement('style');

    // Create the string of all the rules for each color in colors (even more than necessary... do this only once,
    // in case the game parameters / setting change)
    let colorStyleStr = '';
    for (let i=0;i<colors.length; i++){
        colorStyleStr += `.C${i} { background-color: ${colors[i]}; }\n`;
    }

    console.log(colorStyleStr);
    style.innerHTML = colorStyleStr;
    head.appendChild(style);
}








function init(){
    initItemsColorsCSSClasses();
}



init();