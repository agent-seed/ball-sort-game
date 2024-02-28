let N;      // number of full containers / colors
let K;      // number of empty contantars
let H;      // max height (items) of each containers
let moveAsManyItemsAsPossible;
let hideInitial;

settingsInfo = {
    N: {min: 2, max: 13, default: 8, type: 'slider'},
    K: {min: 1, max: 3,  default: 2, type: 'slider'},
    H: {min: 3, max: 6,  default: 5, type: 'slider'},
    moveAsManyItemsAsPossible: {default: true, type: 'checkbox'},
    hideInitial:               {default: true, type: 'checkbox'}
}

let TIME_TRANSITIONS = 60; // todo: take from the css file

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

function removeDescendants(elem){
    while (elem.hasChildNodes()) {
        removeDescendants(elem.lastChild)
        elem.removeChild(elem.lastChild);
    }
}

// from: https://stackoverflow.com/a/143889
// Determines if the passed element is overflowing its bounds,
// either vertically or horizontally.
// Will temporarily modify the "overflow" style to detect this
// if necessary.
function checkOverflow(el)
{
   var curOverflow = el.style.overflow;

   if ( !curOverflow || curOverflow === "visible" )
      el.style.overflow = "hidden";

   var isOverflowing = el.clientWidth < el.scrollWidth 
      || el.clientHeight < el.scrollHeight;

   el.style.overflow = curOverflow;

   return isOverflowing;
}

// https://stackoverflow.com/questions/16512182/how-to-create-empty-2d-array-in-javascript
function create2dArray(rows, cols){
    return [...Array(rows).keys()].map(i => Array(cols));
}

/* Game object, which has C containers and N*H items within them ---------------------------- */

function Game(){
    C = N+K;
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

    // Initialize the moves performed
    this.moves = [];  // elements: [fromCntIdx, toCntIdx, numOfItemsMoved]

    // if hideInitial mode, negative items are hidden
    this.hiddenItems = [...Array(N).fill(hideInitial ? H-1 : 0),...Array(K).fill(0)];

    // Other useful info
    this.equalItemsOnTop = this.table.map((itm,idx) => this.getEqualItemsOnTop(idx));
    this.emptyItemsOnTop = this.table.map((itm,idx) => this.getEmptyItemsOnTop(idx));

    this.typeOfMove = create2dArray(C, C); 
    // the rows are al the possible fromIdx, the column the toIdx of a move
    // the type of move from container fromIdx to container toIdx is:
    // 0: move not allowed
    // 1: 'complete move' (move allowed, no item of the same color remain in the from container)
    // 2: 'incomplete move' (move allowed, but at least an item of the same color remain in the from container)
    for (let fromIdx=0; fromIdx<C; fromIdx++){
        for (let toIdx=0; toIdx<C; toIdx++){
            this.typeOfMove[fromIdx][toIdx] = this.getTypeOfMove(fromIdx,toIdx);
        }
    }

    this.KA = 0; /* additional containers that have been added by the user*/

    // Save the initial data
    this.initialTable            =  deepCopyMatrix(this.table);
    this.initialHiddenItems      =  [...this.hiddenItems];
    this.initialEqualItemsOnTop  =  [...this.equalItemsOnTop];
    this.initialEmptyItemsOnTop  =  [...this.emptyItemsOnTop];
    this.initialTypeOfMove       =  deepCopyMatrix(this.typeOfMove);
}

Game.prototype.addEmptyContainer = function(){
    let newId = C;
    this.KA++;
    C = N+K+this.KA; 

    this.table.push([]);
    this.hiddenItems.push(0);

    // Other useful info
    this.equalItemsOnTop.push(0);
    this.emptyItemsOnTop.push(H);

    // here C is the added container ID: update C next
    this.typeOfMove.push([]);
    for (let cntIdx=0; cntIdx<newId; cntIdx++){
        this.typeOfMove[cntIdx].push(this.getTypeOfMove(cntIdx,newId)); 
        this.typeOfMove[newId].push(this.getTypeOfMove(newId,cntIdx)); 
    }  
    this.typeOfMove[newId].push(this.getTypeOfMove(newId,newId)); 
}


Game.prototype.isMoveAllowed = function(fromIdx,toIdx){
    // get the number of items in the two containers
    let fromN = this.table[fromIdx].length;
    let toN   = this.table[toIdx].length

    // let strTmp = `${fromIdx}>${toIdx} : [${this.table[fromIdx]}] > [${this.table[toIdx]}]`; // debug
    
    // the move is not allowed if:
    // 1) source and destination coincide, or
    // 2) the source is empty, or
    // 3) the destination is full,
    // 4) the destination is not empty, but the color (id) of the top items in the source 
    //    and destination do not match
    if (fromIdx == toIdx || fromN == 0 || toN == H
            || (toN > 0 && this.table[fromIdx][fromN-1] != this.table[toIdx][toN-1]) 
            || hideInitial && this.table[fromIdx].length <= this.hiddenItems[fromIdx]){
        // console.log(strTmp,` ---> no move`); // debug
        return false;
    } else {
        // console.log(strTmp,` ---> [${this.table[fromIdx]}] > [${this.table[toIdx]}]`); // debug
        return true;
    }
};

Game.prototype.makeMove = function(fromIdx,toIdx){
    // this returns 'false' if the move is not performed, 'true' otherwise
    let performedMoves = 0;
    while (this.isMoveAllowed(fromIdx,toIdx) ){
        performedMoves++;
        this.table[toIdx].push(this.table[fromIdx].pop());

        if (!moveAsManyItemsAsPossible){
            // this.makeMoveReverse(toIdx,fromIdx);  // debug
            // this.table[toIdx].push(this.table[fromIdx].pop());  // debug
            break;
        }
    }
    
    if (performedMoves){
        this.moves.push([fromIdx,toIdx,performedMoves]);
        this.updateInfoAfterMove(fromIdx,toIdx);
    }
    
    return performedMoves;
 };

 Game.prototype.undoLastMove = function(){
    // this returns '[]' if the move is not performed, '[fromIdx,toIdx,numOfItemsMoved]' otherwise
    // (ie, the move performed to undo the last one)

    // if there are not previous moves, return false
    if (this.moves.length==0){
        return [];
    }

    let lastMove        = this.moves.pop();
    let fromIdx         = lastMove[1]; // the old move 'toCntIdx'
    let toIdx           = lastMove[0]; // the old move 'fromCntIdx'
    let numOfItemsMoved = lastMove[2];
    // let strTmp = `Undo last move, moving ${numOfItemsMoved} items, ${fromIdx}>${toIdx} : [${this.table[fromIdx]}] > [${this.table[toIdx]}]`; // debug
 
    // undo last moves
    for (let i=0; i<numOfItemsMoved; i++)
        this.table[toIdx].push(this.table[fromIdx].pop());
   
    // console.log(strTmp,` ---> [${this.table[fromIdx]}] > [${this.table[toIdx]}]`); // debug
    this.updateInfoAfterMove(fromIdx,toIdx);
 
    return [fromIdx,toIdx,numOfItemsMoved];
 };
 
 Game.prototype.makeMoveReverse = function(fromIdx,toIdx){
    // this returns 'false' if the reverse move is not performed, 'true' otherwise
    // Note: the direct move is A-->B, the reverse move is B-->A and undo the direct one

    // get the number of items in the two containers
    let fromN = this.table[fromIdx].length;
    let toN   = this.table[toIdx].length

    // let strTmp = `*${fromIdx}>${toIdx} : [${this.table[fromIdx]}] > [${this.table[toIdx]}]`; // debug

    // the reverse move is not allowed if:
    // 1) source and destination coincide, or
    // 2) the source is empty, or
    // 3) the destination is full,
    // 4) the source is not empty, but the color (id) of the two top items in the source 
    //    do not match
    if (fromIdx == toIdx || fromN == 0 || toN == H
        || (fromN>1 && this.table[fromIdx][fromN-1] != this.table[fromIdx][fromN-2]) ){
        // console.log(strTmp,` ---> no move`); // debug
        return false;
    }

    // reverse move allowed: do it
    this.table[toIdx].push(this.table[fromIdx].pop());
   
    // console.log(strTmp,` ---> [${this.table[fromIdx]}] > [${this.table[toIdx]}]`); // debug
    
    // this.table.makeMove(toIdx,fromIdx);  // debug
    // this.table[toIdx].push(this.table[fromIdx].pop());  // debug
 
    return true;
 };
 
 Game.prototype.isSolved = function(){
    // The game is solved if:
    // all the columns are either empty or full with equal items
    // i.e, the number of such columns is C = N+K

    return this.table.filter((container,idx) => (container.length==0
        || (container.length==H && arrayEqualItems(container) && this.hiddenItems[idx]==0)
        )).length == C;
 };

 Game.prototype.getEqualItemsOnTop = function(cntIdx){
    // Recall that the top items are stored in the tail of the array
    // If HideInitial is true, you must ignore the items belows this.hiddenItems[cntIdx] 
    // (if hideInitial...otherwise this is 0...so you can use this.hiddenItems[cntIdx] too)
    
    let cntN = this.table[cntIdx].length;

    // If N=0, there are 0 equal items
    // If N=1, there is just 1 (equal) items
    if (cntN < 2)
        return cntN;

    // Otherwise, explicitly count the equal items
    let eqN = 1;
    for (let i=cntN-2; i>=this.hiddenItems[cntIdx]; i--){
        if (this.table[cntIdx][i] != this.table[cntIdx][cntN-1])
            break;
        eqN++;
    }
    return eqN;
};

Game.prototype.getEmptyItemsOnTop = function(cntIdx){
    return H - this.table[cntIdx].length;
};

Game.prototype.getAfterMoveRemainingItemsOnTop = function(fromIdx,toIdx){
    return Math.max(this.equalItemsOnTop[fromIdx]-this.emptyItemsOnTop[toIdx],0);
};

Game.prototype.getTypeOfMove = function(fromIdx,toIdx){
    // return the type of move:
    // 0: move not allowed
    // 1: 'complete move' (move allowed, no item of the same color remain in the from container)
    // 2: 'incomplete move' (move allowed, but at least an item of the same color remain in the from container)
    if (this.isMoveAllowed(fromIdx, toIdx)){
        let remainingItmFrom = this.getAfterMoveRemainingItemsOnTop(fromIdx,toIdx);
        // console.log(`${fromIdx}>${toIdx}: ${remainingItmFrom}`);
        if (remainingItmFrom==0)
            return 1; // type 1
        else 
            return 2; // type 2
    } else {
        return 0; // type 0
    }
};

Game.prototype.updateInfoAfterMove = function(fromIdx,toIdx){
    /* Update the hidden items number: do this first! */
    if (hideInitial && this.hiddenItems[fromIdx]>0 && this.table[fromIdx].length == this.hiddenItems[fromIdx]){
        this.hiddenItems[fromIdx]--;
    }

    this.equalItemsOnTop[fromIdx] = this.getEqualItemsOnTop(fromIdx);
    this.equalItemsOnTop[toIdx] = this.getEqualItemsOnTop(toIdx);

    this.emptyItemsOnTop[fromIdx] = this.getEmptyItemsOnTop(fromIdx);
    this.emptyItemsOnTop[toIdx] = this.getEmptyItemsOnTop(toIdx);

    for (let cntIdx=0; cntIdx<C; cntIdx++){
        this.typeOfMove[fromIdx][cntIdx] = this.getTypeOfMove(fromIdx,cntIdx);
        this.typeOfMove[toIdx][cntIdx] = this.getTypeOfMove(toIdx,cntIdx);
        this.typeOfMove[cntIdx][fromIdx] = this.getTypeOfMove(cntIdx,fromIdx);
        this.typeOfMove[cntIdx][toIdx] = this.getTypeOfMove(cntIdx,toIdx);
    }
};

 Game.prototype.noMoreMoves = function(){
    // return the move status for the game:
    // 0: there is at least one useful move to do
    // 1: there is at least one useless move to do, but no useful ones
    // 2: there are no more moves to do
    // Note: a move is useless if it leavs some items of the same color in the same container
    let uselessMoves = false;
    for (let fromIdx=0; fromIdx<C; fromIdx++){
        for (let toIdx=0; toIdx<C; toIdx++){
            if (this.typeOfMove[fromIdx][toIdx]==1){
                // 'complete move' (move allowed, no item of the same color remain in the from container)
                return 0;
            } else if (this.typeOfMove[fromIdx][toIdx]==2){
                // 'incomplete move' (move allowed, but at least an item of the same color remain in the from container)
                uselessMoves = true;
            }
        }
    }
    return uselessMoves ? 1 : 2; // move not allowed: chose the output state based on the presence of useless moves
 };

 Game.prototype.restart = function(){
    C = N+K;
    this.KA = 0;
    this.table = deepCopyMatrix(this.initialTable);
    if (hideInitial)
        this.hiddenItems = [...this.initialHiddenItems];

    this.equalItemsOnTop = [...this.initialEqualItemsOnTop];
    this.emptyItemsOnTop = [...this.initialEmptyItemsOnTop];
    this.typeOfMove = deepCopyMatrix(this.initialTypeOfMove);

    this.moves = [];
 };

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
        colorStyleStr += `.I${i} { background-color: ${colors[i]}; }\n`;
    }

    style.innerHTML = colorStyleStr;
    head.appendChild(style);
}

// Create the html structure of the game (containers, items)
// An example of structure is reported next:
        // <div class="table">
        //     <div class="container">
        //         <div class="item I0"></div>
        //         <div class="item I0"></div>
        //     </div>
        //     <div class="container">
        //         <div class="item I1"></div>
        //         <div class="item I0"></div>
        //     </div>
        //     <div class="container">
        //     </div>
        //     <div class="container">
        //         <div class="item I2"></div>
        //         <div class="item I0"></div>
        //         <div class="item I0"></div>
        //         <div class="item I0"></div>
        //     </div>
        //     <div class="container">
        //     </div>
        // </div>

function setNumberOfRowsAndCols(){
    // Note: this function needs to be called on window resize events too

    const maxRows = 4;

    // Let R be the set of all possible values of the number of rows
    // This functions enables the computation of the optimal number of rows (and columns) of containers among R,
    // and the size of the items (balls) to be use, to maximize the space used by table of the game, and make it
    // fit the whole page.
    // The interface becomes responsive

    // It exploits the css variable, so actually what this function does is to define some specific css variables
    // which depends on the variables defined in /css/style.css

    // It is assumed that containers are organized in --nrows rows and --ncols = ceil(C/--nrows) columns, where
    //C is the number of containers.

    // Also, most of the properties of the containers/items are defined as a fraction of the items length 
    // (--item-len), also to simplify the following computations. These are defined by the variable names ending 
    // with ...-frac.

    // This function also computes the number of columns, given the number of rows and of containers (C).
    // This is done in JS because ceil() function is neeeded, and currently css round('up') is not widely supported
    
    let itemLenStr = '';

    for (let nrows=1; nrows<=maxRows; nrows++){
        // For each possible value of rows in R, compute the item size (--item-len-i) which fit the table of the 
        // game in the current page
        document.documentElement.style.setProperty(`--nrows-${nrows}`, nrows.toString());
        document.documentElement.style.setProperty(`--ncols-${nrows}`, Math.ceil(C/nrows).toString());

        // First, the size that the items should have to fill the available horizontal space is computed 
        // (--item-len-horfill-i). The available horizontal space is equal to the --max-width of the page content
        // minus the table left/right padding and the sum of the border of the containers in a row (in general,
        // the fixed width dimensions are to be subtracted here). This available space is divided by the total 
        // occupied space of the remaining items, normalized by --item-len (ie, considering the ...-frac 
        // variables). This way we find --item-len-horfill-i.
        let itemLenHorfillIStr = `calc( (var(--max-width)  - var(--ncols-${nrows}) * 2 * var(--container-border) - 2*var(--hor-padding)) / (var(--ncols-${nrows}) * (1 + 2 * var(--container-padding-frac) + var(--table-gap-frac) )))`
        document.documentElement.style.setProperty(`--item-len-horfill-${nrows}`, itemLenHorfillIStr);
 
        // Second, the size that the items should have to fill the available vertical space is computed 
        // (--item-len-verfill). This is done similarly to the previous case. However, the available space is the 
        // total viewport height, minus the header, nav and footer height, as well as the table padding.
        let itemLenVerfillIStr = `calc( (100dvh - var(--nrows-${nrows}) * var(--container-border) - var(--hdr-height) - var(--nav-height) - var(--ftr-height) - 2 * var(--table-ver-padding)) / (var(--nrows-${nrows}) * (var(--H) + 2 * var(--container-padding-frac) + var(--container-extra-padding-top-frac) + ( var(--H) - 1 ) * var(--container-gap-frac) + var(--container-extra-margin-top-frac)) + ( var(--nrows-${nrows}) - 1) * var(--table-gap-frac) ) )`;
        document.documentElement.style.setProperty(`--item-len-verfill-${nrows}`, itemLenVerfillIStr);
    
        // The minimum of the two (--item-len-horfill-i, --item-len-verfill-i) is used as --item-len, in order
        // to fit in both the horizontal and vertical available space.
        let itemLenIStr = `min(var(--item-len-horfill-${nrows}), var(--item-len-verfill-${nrows}))`;
        document.documentElement.style.setProperty(`--item-len-${nrows}`, itemLenIStr);

        itemLenStr += `${nrows==1?'':', '} var(--item-len-${nrows})`;
    }

    // Now chose the size of each item (--item-len) as the maximum among the computed ones, ie --item-len-1,
    // --item-len-2, ...
    document.documentElement.style.setProperty(`--item-len`, `max(${itemLenStr})`);

    // The actual number of rows is computed in javascript, as the value which avoids overflow */
    // To select the actual number of nrows corresponding to the 'optimal' --item-len, try using each possible 
    // pair of number of columns and rows, keeping the same 'optimal' --item-len
    // Select the pair which does not overflow the page
    for (let nrows=maxRows; nrows>0; nrows--){
        document.documentElement.style.setProperty("--nrows", nrows.toString());
        document.documentElement.style.setProperty("--ncols", Math.ceil(C/nrows).toString());

        if (!checkOverflow(document.body))
            return;
    }
}

function createTableHTML(table){
    // Set the current H
    // document.documentElement is ::root
    document.documentElement.style.setProperty("--H", H.toString());

    let container_div, item_div;
    table_div = document.createElement('div'); // set the global variable
    table_div.classList.add('table');
    container_divs = [];

    // Starting from an empty 'table', add the containers as specified in 'table'
    for (let i=0; i<table.length; i++){
        container = table[i];
        container_div = document.createElement('div');
        container_div.classList.add('container');
        container_div.addEventListener('click',containerClick_callback);
        container_div.cntId = i; /* assign the container id */
     
        // for each container, add the items, as specified in 'table' items
        for (let j=0;j<container.length;j++){
           item_div = document.createElement('div');
           item_div.classList.add('item');
           item_div.classList.add('I' + container[j]);
           if (hideInitial && j<container.length-1){
                item_div.classList.add('hidden');
           }
           container_div.appendChild(item_div);
        }
     
        table_div.appendChild(container_div);
        container_divs.push(container_div);
     }

     // Apply the created table to the main html
     document.querySelector('main div.game').appendChild(table_div);

     setNumberOfRowsAndCols();
}

function addEmptyContainerToTableHTML(){
    let container_div = document.createElement('div');
    container_div.classList.add('container');
    container_div.cntId = C-1; /* assign the container id */
    container_div.addEventListener('click',containerClick_callback);

    table_div.appendChild(container_div);
    container_divs.push(container_div);

    setNumberOfRowsAndCols();    
}

function deleteTableHTML(){
    let main = document.querySelector('main div.game');
    removeDescendants(main);
}

function newGame(){
    // Clear the current table
    deleteTableHTML();
    game = undefined;

    // Create a new game
    game = new Game();
    createTableHTML(game.table);

    // No items selected initially
    fromContainer_div = undefined;
}

function restartGame(){
    // Clear the current table
    deleteTableHTML();

    // Create a new game
    game.restart();

    createTableHTML(game.table);

    // No items selected initially
    fromContainer_div = undefined;
}


function selectFromContainer(thisContainer_div){
    if (thisContainer_div.lastElementChild != null){ /* #1 */
        fromContainer_div = thisContainer_div;
        fromContainer_div.classList.add('selected');
        console.log(`Container ${thisContainer_div.cntId} selected`);
    } else {
        console.log(`Container ${thisContainer_div.cntId} not selected (it is empty)`);
    }
}

function unselectFromContainer(){
    console.log(`Container ${fromContainer_div.cntId} unselected`);
    fromContainer_div.classList.remove('selected');
    fromContainer_div = undefined;
}

function containerClick_callback(e){

    let thisContainer_div = e.target;
    // https://stackoverflow.com/questions/1279957/how-to-move-an-element-into-another-element
    // https://stackoverflow.com/questions/1183872/put-a-delay-in-javascript

    if(fromContainer_div){
        // The 'from' container for a move is already set
        if (thisContainer_div === fromContainer_div){
            // Ignore the move if this container is the 'from' one
            unselectFromContainer();
        } else {
            // Check if the move can be performed: if so, apply the modification to the DOM
            let numberOfMovesToDo = game.makeMove(fromContainer_div.cntId, thisContainer_div.cntId);

            if (numberOfMovesToDo>0){

                console.log(`Moving ${numberOfMovesToDo} items from ${fromContainer_div.cntId} to ${thisContainer_div.cntId}`);

                // disable pointer events
                table_div.style.pointerEvents = 'none';

                // The item to move exists by construction (see #1 comment from function selectFromContainer)

                // Old version: single move
                // let itmToMove = fromContainer_div.lastElementChild;
                // itmToMove.classList.add('move');
                // New version: move numberOfMovesToDo items
                let itmsToMove = [... fromContainer_div.children].slice(-numberOfMovesToDo);
                itmsToMove.forEach((itm) => {itm.classList.add('move')} );

                // Wait for the animation (item out 'from' container)
                setTimeout(function() {

                    // Old version: single move
                    // thisContainer_div.appendChild(itmToMove);
                    // New version: move numberOfMovesToDo items
                    itmsToMove.forEach((itm) => {thisContainer_div.appendChild(itm)} );

                    if (hideInitial && fromContainer_div.hasChildNodes()){
                        fromContainer_div.lastElementChild.classList.remove('hidden'); // if present
                    }

                    unselectFromContainer();

                    // Wait for the animation (item in 'this' container)
                    setTimeout(function() {
                        // Old version: single move
                        // itmToMove.classList.remove('move');
                        // New version: move numberOfMovesToDo items
                        itmsToMove.forEach((itm) => {itm.classList.remove('move')} );

                        // re-enable pointer events
                        table_div.style.pointerEvents = 'auto';

                        // Show the game outcome if certain conditions are met (e.g., win, no more moves)
                        showGameOutcome();

                    }, TIME_TRANSITIONS);
                }, TIME_TRANSITIONS);
            } else {
                /* The move cannot be performed: change the selected 'from' container to this containter */
                console.log(`Cannot move from ${fromContainer_div.cntId} to ${thisContainer_div.cntId} !`);

                /* todo: add animation */

                unselectFromContainer();
                selectFromContainer(thisContainer_div);
            }
        }
    } else {
        // Set the 'from' container for a move, if there is at least an element to move
        selectFromContainer(thisContainer_div);
    }
}

// Show the game outcome if certain conditions are met (e.g., win, no more moves)
function showGameOutcome(){
    if(game.isSolved()){
        wonMsg_dialog.show(); // non modal dialog
    } else{
        let statusOfMoves = game.noMoreMoves();
        if (statusOfMoves==1)
            noMoreUsefulMovesMsg_dialog.show(); // non modal dialog
        else if (statusOfMoves==2)
            noMoreMovesMsg_dialog.show(); // non modal dialog
    }
}

function closeGameOutcome(){
    wonMsg_dialog.close();
    noMoreUsefulMovesMsg_dialog.close();
    noMoreMovesMsg_dialog.close();
}

function setHeaderBasedOnStyle(){
    let styleStr;
    if (table_div.parentElement.classList.contains("liquid")){
        document.querySelector('header button.toggle-style').classList.add('liquid');
        styleStr = 'Liquid';
    } else {
        document.querySelector('header button.toggle-style').classList.remove('liquid');
        styleStr = 'Ball';
    }
    document.title = `${styleStr} Sort Game`;
    document.querySelector('header h1').textContent = document.title;  
}

/* || Buttons event listener */

function toggleStyleBtn_callback(){
    let game_div = table_div.parentElement;
    game_div.classList.toggle("liquid");
    setHeaderBasedOnStyle();
}


function newBtn_callback(){
    closeGameOutcome();
    newGame();
}

function restartBtn_callback(){
    closeGameOutcome();
    restartGame();
}

function undoBtn_callback(){
    closeGameOutcome();

    let lastMove = game.undoLastMove();
    if (lastMove.length){
        let fromIdx = lastMove[0];
        let toIdx = lastMove[1];
        let numOfItemsMoved = lastMove[2];

        console.log(`Undo last move, moving ${numOfItemsMoved} items from ${container_divs[fromIdx].cntId} to ${container_divs[toIdx].cntId}`); // debug

        for (let i=0; i<numOfItemsMoved; i++){
            let itmToMove = container_divs[fromIdx].lastElementChild;
            container_divs[toIdx].appendChild(itmToMove);
        }
        // Show the game outcome if certain conditions are met (e.g., win, no more moves)
        showGameOutcome();
    }
}

function addcontainer_callback(){
    // The minimum number of empty containers to have to be able to solve EVERY istance of the game 
    // having fixed H and N is ceil((H-1)/H*N)
    // Source: Ito, T et al, "Sorting Balls and Water: Equivalence and Computational Complexity", 
    // arXiv:2202.09495 [cs.CC]
    // available at https://arxiv.org/pdf/2202.09495.pdf
    console.log(K+game.KA,C-N,Math.ceil((H-1)/H*N));
    if (C-N > Math.ceil((H-1)/H*N))
        return;

    closeGameOutcome();
    game.addEmptyContainer();
    addEmptyContainerToTableHTML();
}


/* || Setting dialog */

function initSettings(){
    N = settingsInfo.N.default;
    K = settingsInfo.K.default;
    H = settingsInfo.H.default;
    C = N + K; // number of containers (empty + full)
    moveAsManyItemsAsPossible = settingsInfo.moveAsManyItemsAsPossible.default;
    hideInitial = settingsInfo.hideInitial.default;

    initSettingsDialog();
}

function initSettingsDialog(){
    for (let param in settingsInfo){
        switch (settingsInfo[param].type){
            case 'slider':
                let slider = document.querySelector(`.slider-container#set-${param} .slider`);
                let sliderDiv = document.createElement('div');
                slider.appendChild(sliderDiv);

                noUiSlider.create(sliderDiv, {
                    start: [settingsInfo[param].default],
                    connect: [true, false],
                    behaviour: 'smooth-steps-tap',
                    range: {
                        'min': settingsInfo[param].min,
                        'max': settingsInfo[param].max
                    },
                    format: {
                        // 'to' the formatted value. Receives a number.
                        to: function (value) {
                            return Math.round(value);
                        },
                        // 'from' the formatted value.
                        // Receives a string, should return a number.
                        from: function (value) {
                            return value;
                        }
                    },
                    tooltips: true,
                    step: 1
                });
                // /* Just for testing: parameters are not set this way */
                // sliderDiv.noUiSlider.on('change', function (values, handle) {
                //     switch(param){
                //         case 'N':
                //             N=values[handle];
                //             C=N+K;
                //             break;
                //         case 'K':
                //             K=values[handle];
                //             C=N+K;
                //             break;
                //         case 'H':
                //             H=values[handle];
                //             break;
                //     }
                //     newGame(); // no call it on dialog close
                // });
                break;
            case 'checkbox':
                let checkbox = document.querySelector(`.checkboxes input#set-${param}`);
                checkbox.checked = settingsInfo[param].default;
                break;
        }
    }
}

function settingsDialogCancelBtn_callback(){
    document.querySelector(`.slider-container#set-N .slider > div`).noUiSlider.set(N);
    document.querySelector(`.slider-container#set-K .slider > div`).noUiSlider.set(K);
    document.querySelector(`.slider-container#set-H .slider > div`).noUiSlider.set(H);
    document.querySelector(`.checkboxes input#set-moveAsManyItemsAsPossible`).checked = moveAsManyItemsAsPossible;
    document.querySelector(`.checkboxes input#set-hideInitial`).checked = hideInitial;

    document.querySelector('dialog.settings').close()
}


function settingsDialogSaveBtn_callback(){
    closeGameOutcome();

    N = document.querySelector(`.slider-container#set-N .slider > div`).noUiSlider.get();
    K = document.querySelector(`.slider-container#set-K .slider > div`).noUiSlider.get();
    H = document.querySelector(`.slider-container#set-H .slider > div`).noUiSlider.get();
    C = N + K;
    moveAsManyItemsAsPossible = document.querySelector(`.checkboxes input#set-moveAsManyItemsAsPossible`).checked;
    hideInitial = document.querySelector(`.checkboxes input#set-hideInitial`).checked;

    newGame();
    document.querySelector('dialog.settings').close()
}


/* || Initailization */

function init(){
    initItemsColorsCSSClasses();
    initSettings();

    let toggleStyleBtn = document.querySelector('button.toggle-style');
    toggleStyleBtn.addEventListener('click',toggleStyleBtn_callback);    

    let newBtn = document.querySelector('button.new');
    newBtn.addEventListener('click',newBtn_callback);

    let restartBtn = document.querySelector('button.restart');
    restartBtn.addEventListener('click',restartBtn_callback);

    let undoBtn = document.querySelector('button.undo');
    undoBtn.addEventListener('click',undoBtn_callback);

    let addcontainerBtn = document.querySelector('button.addcontainer');
    addcontainerBtn.addEventListener('click',addcontainer_callback);

    let rulesBtn = document.querySelector('button.rules');
    let rulesDialog = document.querySelector('dialog.rules');
    let rulesDialogCloseBtn = document.querySelector('dialog.rules .dialog-buttons button.close');
    rulesBtn.addEventListener('click', () => rulesDialog.showModal());
    rulesDialogCloseBtn.addEventListener('click', () => rulesDialog.close());

    let settingsBtn = document.querySelector('button.settings');
    let settingsDialog = document.querySelector('dialog.settings');
    let settingsDialogCancelBtn = document.querySelector('dialog.settings .dialog-buttons button.cancel');
    let settingsDialogSaveBtn = document.querySelector('dialog.settings .dialog-buttons button.save');
    settingsBtn.addEventListener('click', () => settingsDialog.showModal());
    settingsDialogCancelBtn.addEventListener('click', settingsDialogCancelBtn_callback);
    settingsDialogSaveBtn.addEventListener('click', settingsDialogSaveBtn_callback);

    wonMsg_dialog = document.querySelector('#won-msg');
    noMoreUsefulMovesMsg_dialog = document.querySelector('#noMoreUsefulMoves-msg');
    noMoreMovesMsg_dialog = document.querySelector('#noMoreMoves-msg');

    window.addEventListener('resize',setNumberOfRowsAndCols);

    // Create a new game
    newGame();
    setHeaderBasedOnStyle();
}


let game; // global variable representing the current game
let table_div; // global variable representing the current game HTML interface
let container_divs;
let fromContainer_div;

let wonMsg_dialog,noMoreMovesMsg_dialog,noMoreUsefulMovesMsg_dialog;


init();