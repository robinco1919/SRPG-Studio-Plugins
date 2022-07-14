/*--------------------------------------------------------------------------
	Berwick Saga Turn System, v0.2
	Created by robinco
	
	Changes the turn system to how it works in Berwick Saga. This means that
	control will alternate between players and enemies until all units have
	moved, at which point a new turn is started.
	
	How to use:
	- Add this script to your project's Plugin folder. 
	- Also add the BWS_turn folder to your project's Materials folder.
	  This contains very basic icons for the turn order list, which you can
	  feel free to change.
	
	Important notes/known issues:
	- Set scroll speed in the Config to normal/slow (fast has some visual 
	  bugs which I haven't worked out yet)
	- There may be a problem with refreshers if they move last
	- Consider turning on unit markers and/or HP bars to see unit 
	  affiliation for waiting units
	- You may also want to update the Player Phase graphic to something that
	  says "New Turn" or similar
	- This plugin is still in a beta stage, so I'm expecting some bugs
	  and compatability issues to pop up. If you find anything, please let
	  me know on the SRPG Studio University Discord Server or Discord handle
	  robinco#7435
	- Also feel free to edit the plugin as you please
	 
	 Release History:
	 12/07/2022: v0.1, 
		- First beta release
	 13/07/2022: v0.2, 
		- No action/auto AI/berserk states should be functioning
		  correctly now (berserked units move at the end of the turn)
		- Slight change to reinforcements (they appear at end of turn)
		- Bug fix where player leaves the map before finishing their action 
		  (e.g. dying to a counterattack, leaving via an event command). 
		  The turn list is now update correctly in these scenarios
		- Bug fix for units which change affilation via an event --
		  the turn list is now correctly updated
					   
--------------------------------------------------------------------------*/

// Info for turn icons in window
var BWSICON_SETTING = {
	  Folder     : 'BWS_turn_icons'
	, Img        : 'bws_turn_icons.png'
	, IconWidth  : 24
	, IconHeight : 24
};

/*--------------------------------------------------------------------------
	Main script
--------------------------------------------------------------------------*/

var BWSTurnSystem = {
	
	turnList: [],
	currentTurn: 0,
	numUnitArray: [0, 0, 0],
	streakArray: [0, 0, 0],
	fromLastTurn: [0, 0, 0],
	
	// this runs when the turn starts. Creates the list of turns
	// for now we have player = 0, enemy = 1, (later ally = 2)
	// as defined TURNTYPE in constants-enumeratedtype.js
	initialiseList: function() {
		var numPlayer = PlayerList.getControllableList().getCount();
		var numEnemy = EnemyList.getControllableList().getCount();
		var numAlly = AllyList.getControllableList().getCount();
		var totalUnits = numPlayer + numEnemy + numAlly;
		
		root.log(numPlayer + ' players')
		root.log(numEnemy + ' enemies')
		root.log(numAlly + ' allies')
		root.log(totalUnits + ' total')
		
		this.turnList = []; // empty list
		this.numUnitArray = [numPlayer, numEnemy, numAlly]; // might use this later
		this.streakArray = [0, 0, 0];
		this.fromLastTurn = [0, 0, 0];
		
		var playerStreak = 0; // now this.streakArray[TurnType.PLAYER]
		var enemyStreak = 0; // now this.streakArray[TurnType.ENEMY]
		var allyStreak = 0; // now this.streakArray[TurnType.ALLY]
		
		var i = 0;
		// player goes 1st, enemy goes 2nd, ally goes 3rd
		if (this.numUnitArray[TurnType.PLAYER] > 0) {
			this.pushPlayer();
			i += 1;
		}
		if (this.numUnitArray[TurnType.ENEMY] > 0) {
			this.pushEnemy();
			i += 1;
		}		
		if (this.numUnitArray[TurnType.ALLY] > 0) {
			this.pushAlly();
			i += 1;
		}
		
		
		for (i = i; i < totalUnits; i++) {
			// this is the hard bit -_-
			// 2 (later 3) cases: player just went/enemy just went.
			// we use 'streaks' (i.e. how many players/enemies have had their turn in a row)
			// to determine who goes next.
			
			//root.log('P/E/A left: ' + this.numUnitArray)
			//root.log(this.streakArray)
			
			// player just went
			if (this.streakArray[TurnType.PLAYER] > 0) {
				if (this.numUnitArray[TurnType.PLAYER] > (this.streakArray[TurnType.PLAYER] + 1) * this.numUnitArray[TurnType.ENEMY] && this.numUnitArray[TurnType.PLAYER] > (this.streakArray[TurnType.PLAYER] + 1) * this.numUnitArray[TurnType.ALLY]) {
					this.pushPlayer();				
				}
				else {
					if (this.numUnitArray[TurnType.ENEMY] * this.fromLastTurn[TurnType.ENEMY] >= this.numUnitArray[TurnType.ALLY] * this.fromLastTurn[TurnType.ALLY]) {
						this.pushEnemy();	
					}
					else {
						this.pushAlly();							
					}
				}
			}
			
			// enemy just went
			else if (this.streakArray[TurnType.ENEMY] > 0) {
				if (this.numUnitArray[TurnType.ENEMY] > (this.streakArray[TurnType.ENEMY] + 1) * this.numUnitArray[TurnType.PLAYER] && this.numUnitArray[TurnType.ENEMY] > (this.streakArray[TurnType.ENEMY] + 1) * this.numUnitArray[TurnType.ALLY]) {
					this.pushEnemy();					
				}
				else {
					if (this.numUnitArray[TurnType.PLAYER] * this.fromLastTurn[TurnType.PLAYER] >= this.numUnitArray[TurnType.ALLY] * this.fromLastTurn[TurnType.ALLY]) {
						this.pushPlayer();	
					}
					else {
						this.pushAlly();						
					}
				}
			}
			
			// ally just went
			else if (this.streakArray[TurnType.ALLY] > 0) {
				if (this.numUnitArray[TurnType.ALLY] > (this.streakArray[TurnType.ALLY] + 1) * this.numUnitArray[TurnType.PLAYER] && this.numUnitArray[TurnType.ALLY] > (this.streakArray[TurnType.ALLY] + 1) * this.numUnitArray[TurnType.ENEMY]) {
					this.pushAlly();				
				}
				else {
					if (this.numUnitArray[TurnType.PLAYER] * this.fromLastTurn[TurnType.PLAYER] >= this.numUnitArray[TurnType.ENEMY] * this.fromLastTurn[TurnType.ENEMY]) {
						this.pushPlayer();	
					}
					else {
						this.pushEnemy();						
					}
				}
			}

		}
	},
	
 	pushPlayer: function() {
		// push player onto the turn list
		this.turnList.push(TurnType.PLAYER);
		this.numUnitArray[TurnType.PLAYER] -= 1
		this.streakArray = [this.streakArray[TurnType.PLAYER] + 1, 0, 0];
		this.fromLastTurn = [0, this.fromLastTurn[TurnType.ENEMY] + 1, this.fromLastTurn[TurnType.ALLY] + 1];
	},
	
	pushEnemy: function() {
		// push enemy onto the turn list
		this.turnList.push(TurnType.ENEMY);
		this.numUnitArray[TurnType.ENEMY] -= 1
		this.streakArray = [0, this.streakArray[TurnType.ENEMY] + 1, 0];
		this.fromLastTurn = [this.fromLastTurn[TurnType.PLAYER] + 1, 0, this.fromLastTurn[TurnType.ALLY] + 1];
	},
	
	 
	pushAlly: function() {
		// push ally onto the turn list
		this.turnList.push(TurnType.ALLY);
		this.numUnitArray[TurnType.ALLY] -= 1
		this.streakArray = [0, 0,  this.streakArray[TurnType.ALLY] + 1];
		this.fromLastTurn = [this.fromLastTurn[TurnType.PLAYER] + 1, this.fromLastTurn[TurnType.ENEMY] + 1, 0];
	},
	 
	
	shiftList: function() {
		// after a unit ends their action, remove first one in the list
		this.turnList.shift();
		
		// moved elsewhere
/* 		// if it's empty, start a new turn
		if (this.turnList.length === 0) {
			this.newTurn();
			this.initialiseList();
		} */
		
		// calling it all the time, the function will sort out if there's anything
		// which actually has to be done (i.e. changes iun number of units, changes in
		// unit affilation, etc.)
		// a little inelegant but w/e
		this.updateList(); 
	
	
		// do all the other fancy new turn stuff
		// currently ending turn after each action (so can have multiple player phase/enemy phases in a row)
		TurnControl.turnEnd();
	},
	
	newTurn: function() {
		// we need to do this to ALL units, not just the affiliation of the last unit
		var i, j, unit;
		
		// dodgily join all 3 lists together.
		// afaik there's no simple way to get ALL units since players are part of MetaSession
		// while enemies/players are part of GameSession (see singleton-unitlist.js)
		var playerList = PlayerList.getAliveList();
		var enemyList = EnemyList.getAliveList();
		var allyList = AllyList.getAliveList();
		var list = [playerList, enemyList, allyList]//TurnControl.getActorList();
		//root.log('NOW it is new turn')
		
		for (j = 0; j < 3; j++) {
			var count = list[j].getCount();
		
			for (i = 0; i < count; i++) {
				unit = list[j].getData(i);
				unit.setWait(false);//this._removeWaitState(unit);
				
				unit = FusionControl.getFusionChild(unit);
				if (unit !== null) {
					// Deactivate a wait state of the units who are fused.
					unit.setWait(false);//this._removeWaitState(unit);
				}	
			}
		}	
		
		// make a new turn list
		this.initialiseList();
		
		// increase turn count
		root.getCurrentSession().setTurnCount(root.getCurrentSession().getTurnCount() + 1);
		root.getCurrentSession().increaseRelativeTurn();
		
		// plus like per turn states,healing etc.
		
	},
	
	updateList: function() {
		// after a unit dies or leaves the map
		// also perhaps if a unit joins mid-turn or swaps affiliations?
		// we'll have to look at the affiliation of who has died/left, then remove the last(?) occurence of that affiliation
		
		// calling it all the time, the function will sort out
		
		var numPlayer = PlayerList.getUnmovedList().getCount();
		var numEnemy = EnemyList.getUnmovedList().getCount();
		var numAlly = AllyList.getUnmovedList().getCount();
		var numPlayersInList = this.countType(TurnType.PLAYER);
		var numEnemiesInList = this.countType(TurnType.ENEMY);;
		var numAlliesInList = this.countType(TurnType.ALLY);;

		root.log(numPlayer + ' / ' + numPlayersInList)
		root.log(numEnemy + ' / ' + numEnemiesInList)
		root.log(numAlly + ' / ' + numAlliesInList)
		
		// 1st case: number of player ne no of 0s in list
		// doing for rather than while loops in case I stuff up to avoid infinite loops
		if (numPlayersInList > numPlayer) {
			for (i = 0; i < (numPlayersInList - numPlayer); i++) {
				// remove the last 0
				removeIndex = this.lastIndex(this.turnList, TurnType.PLAYER);
				this.turnList.splice(removeIndex, 1);	
			}
		}
		if (numPlayersInList < numPlayer) {
			for (i = 0; i < (numPlayer - numPlayersInList); i++) {
				// add an extra 0 at the end
				this.turnList.push(TurnType.PLAYER)				
			}
		}
		
		// 2nd case: number of enemy ne no of 1s in list
		if (numEnemiesInList > numEnemy) {
			for (i = 0; i < (numEnemiesInList - numEnemy); i++) {
				// remove the last 1
				removeIndex = this.lastIndex(this.turnList, TurnType.ENEMY);
				this.turnList.splice(removeIndex, 1);				
			}
		}
		if (numEnemiesInList < numEnemy) {
			for (i = 0; i < (numEnemy - numEnemiesInList); i++) {
				// add an extra 1 at the end
				this.turnList.push(TurnType.ENEMY)				
			}
		}
	
		
		// 3nd case: number of ally ne no of 2s in list
		if (numAlliesInList > numAlly) {
			for (i = 0; i < (numAlliesInList - numAlly); i++) {
				// remove the last 2
				removeIndex = this.lastIndex(this.turnList, TurnType.ALLY);
				this.turnList.splice(removeIndex, 1);				
			}
		}
		if (numAlliesInList < numAlly) {
			for (i = 0; i < (numAlly - numAlliesInList); i++) {
				// add an extra 2 at the end
				this.turnList.push(TurnType.ALLY)				
			}
		}
		
		//root.log('now list is ' + this.turnList)
		
	},
	
	countType: function(turnType) {
		// counts the number of a particular affiliation in the turn list
		var numInList = 0;
		for (i = 0; i < this.turnList.length; i++) {
			if (this.turnList[i] === turnType) {
				numInList += 1;
			}
		}
		return numInList;
	},
	
	// idk might need this function
	lastIndex: function(arr, target) {
		var count = arr.length;
		var currentIndex = count - 1;
		
		for (i = currentIndex; i >= 0; i--) {
			if (arr[i] === target) {
				return currentIndex;
			}
			else {
				currentIndex -= 1;
			}
		}
		return currentIndex;
	},
	
	// called by the End Turn command in map command list
	// basically remove all 0s for the list and let the rest play out
	endPlayerTurn: function() {
		var turnListCount = this.turnList.length;
		var playerList = PlayerList.getControllableList();
		var playerListCount = playerList.getCount();
		var unit;
		
		for (i = 0; i < turnListCount; i++) {
			if (this.turnList[i] === TurnType.PLAYER) {
				this.turnList.splice(i, 1);	
			}
		}
		
		// also set all units to wait (mainly a visual thing)
		for (i = 0; i < playerListCount; i++) {
			unit = playerList.getData(i);
			unit.setWait(true);
		}
		TurnControl.turnEnd();
	}

};



AllUnitList.getUnmovedList = function(list) {
	var funcCondition = function(unit) {
		return (unit.getAliveState() === AliveType.ALIVE && 
		!unit.isWait() && 
		FusionControl.getFusionParent(unit) === null &&
		StateControl.isTargetControllable(unit)); // bad states, e.g. sleep where you don't control
	};
		
	return this.getList(list, funcCondition);
};

PlayerList.getUnmovedList = function() {
	return AllUnitList.getUnmovedList(this.getMainList());
};

EnemyList.getUnmovedList = function() {
	return AllUnitList.getUnmovedList(this.getMainList());
};

AllyList.getUnmovedList = function() {
	return AllUnitList.getUnmovedList(this.getMainList());
};


// alternate version of getAliveList that removes units who cannot be controlled (e.g. sleep)
AllUnitList.getControllableList = function(list) {
	var funcCondition = function(unit) {
		return (unit.getAliveState() === AliveType.ALIVE && 
		FusionControl.getFusionParent(unit) === null &&
		StateControl.isTargetControllable(unit)); // bad states, e.g. sleep where you don't control
	};
		
	return this.getList(list, funcCondition);
};

PlayerList.getControllableList = function() {
	return AllUnitList.getControllableList(this.getMainList());
};

EnemyList.getControllableList = function() {
	return AllUnitList.getControllableList(this.getMainList());
};

AllyList.getControllableList = function() {
	return AllUnitList.getControllableList(this.getMainList());
};



// simplify this
MapParts.BWSTurnWindow = defineObject(BaseMapParts,
{
	drawMapParts: function() {
		var x = this._getPositionX();
		var y = this._getPositionY();
		
		this._drawMain(x, y);
	},
	
	_drawMain: function(x, y) {
		var width = this._getWindowWidth();
		var height = this._getWindowHeight();
		var textui = this._getWindowTextUI();
		var pic = textui.getUIImage();
		
		WindowRenderer.drawStretchWindow(x, y, width, height, pic);
		
		x += this._getWindowXPadding() / 2;
		y += this._getWindowYPadding() / 2;
		this._drawContent(x, y);
	},
	
	_drawContent: function(x, y) {
		var text;
		var textui = this._getWindowTextUI();
		var font = textui.getFont();
		var color = textui.getColor();
		var length = this._getTextLength();
		
		// image
		var pic = root.getMaterialManager().createImage(BWSICON_SETTING.Folder, BWSICON_SETTING.Img);
		var width = BWSICON_SETTING.IconWidth;
		var height = BWSICON_SETTING.IconHeight;
		var turnIcon;
		var x2 = x;
		
		for (i = 0; i < 5; i++) {
			if (i+1 > BWSTurnSystem.turnList.length) {break}
			turnIcon = BWSTurnSystem.turnList[i];
			pic.drawParts(x2, y, turnIcon*width, 0, width, height);
			TextRenderer.drawText(x2+8, y+3, i+1, length, color, font);
			x2 += width;
		}
	},
	
	_getTextLength: function() {
		return this._getWindowWidth() - DefineControl.getWindowXPadding();
	},
	
	_getPositionX: function() {
		var dx = LayoutControl.getRelativeX(10) - 54;
		
		return root.getGameAreaWidth() - this._getWindowWidth() - dx;
	},
	
	_getPositionY: function() {
		var x, dx, y, dy;
		var yBase = LayoutControl.getRelativeY(10) - 28;
		var turnType = root.getCurrentSession().getTurnType();
		
		// window can move around on player phase where there's a cursor, but will remain in the top right corner
		// for enemy/ally phase
		
		if (turnType === TurnType.PLAYER) {
			x = root.getCurrentSession().getMapCursorX()*GraphicsFormat.MAPCHIP_WIDTH;//LayoutControl.getPixelX(this.getMapPartsX());
			dx = root.getGameAreaWidth() / 2;
			y = root.getCurrentSession().getMapCursorY()*GraphicsFormat.MAPCHIP_HEIGHT;//LayoutControl.getPixelY(this.getMapPartsY());
			dy = root.getGameAreaHeight() / 2;
			if (x > dx && y < dy) {
				return root.getGameAreaHeight() - this._getWindowHeight() - yBase;
			}
			else {
				return yBase;
			}
		}
		else {
			return yBase;
		}
	},
	
	_getWindowXPadding: function() {
		return DefineControl.getWindowXPadding();
	},
	
	_getWindowYPadding: function() {
		return DefineControl.getWindowYPadding();
	},
	
	_getWindowWidth: function() {
		return 140;
	},
	
	_getWindowHeight: function() {
		return 24 + this.getIntervalY();
	},
	
	_getWindowTextUI: function() {
		return root.queryTextUI('default_window');
	}
}
);


MapParts.Terrain._getPositionY = function() {
	var x = LayoutControl.getPixelX(this.getMapPartsX());
	var dx = root.getGameAreaWidth() / 2;
	var y = LayoutControl.getPixelY(this.getMapPartsY());
	var dy = root.getGameAreaHeight() / 2;
	var yBase = LayoutControl.getRelativeY(10) - 28 + 60; //offset for turn order window
	
	if (x > dx && y < dy) {
		return root.getGameAreaHeight() - this._getWindowHeight() - yBase;
	}
	else {
		return yBase;
	}
};


// could be alaised
// the ONLY time we don't want the turn window to show is during real battles
// on the player turn (part of PlayerTurnMode.UNITCOMMAND)
PlayerTurn.drawTurnCycle = function() {
	var mode = this.getCycleMode();
	
	if (mode === PlayerTurnMode.AUTOCURSOR) {
		this._drawAutoCursor();
		MapParts.BWSTurnWindow.drawMapParts();
	}
	else if (mode === PlayerTurnMode.AUTOEVENTCHECK) {
		this._drawAutoEventCheck();
		MapParts.BWSTurnWindow.drawMapParts();
	}
	else if (mode === PlayerTurnMode.MAP) {
		this._drawMap();
		MapParts.BWSTurnWindow.drawMapParts();
	}
	else if (mode === PlayerTurnMode.AREA) {
		this._drawArea();
		MapParts.BWSTurnWindow.drawMapParts();
	}
	else if (mode === PlayerTurnMode.MAPCOMMAND) {
		this._drawMapCommand();
		MapParts.BWSTurnWindow.drawMapParts();
	}
	// this case treated differetly (see below)
	else if (mode === PlayerTurnMode.UNITCOMMAND) {
		this._drawUnitCommand();
	}
	
};

MapSequenceCommand.drawSequence = function() {
	var mode = this.getCycleMode();
	MapParts.BWSTurnWindow.drawMapParts(); // add here instead
	
	if (mode === MapSequenceCommandMode.COMMAND) {
		this._unitCommandManager.drawListCommandManager();
	}
	else if (mode === MapSequenceCommandMode.FLOW) {
		this._straightFlow.drawStraightFlow();
	}
};


/* MapPartsCollection._configureMapParts = function(groupArray) {
	if (EnvironmentControl.isMapUnitWindowDetail()) {
		groupArray.appendObject(MapParts.UnitInfo);
	}
	else {
		groupArray.appendObject(MapParts.UnitInfoSmall);
	}
	groupArray.appendObject(MapParts.Terrain);
	groupArray.appendObject(MapParts.BWSTurnWindow);
} */


// autocursor stuff:
// we're going to let the cursor move to the first unmoved unit in the player list,
// regardless of whether autocursor is turned on or off in config
// (otherwise if autocursor is turned off, it will keep moving to the point where the
// cursor was at the end of the last turn, which feels weird)

PlayerTurn._moveAutoCursor = function() {
	var x, y, pos;
	
	if (this._mapLineScroll.moveLineScroll() !== MoveResult.CONTINUE) {
		pos = this._getDefaultCursorPos();
		if (pos !== null) { // && EnvironmentControl.isAutoCursor()) {
			x = pos.x;
			y = pos.y;
		}
		else {
			x = this._xAutoCursorSave;
			y = this._yAutoCursorSave;
		}
		MapView.changeMapCursor(x, y);
		this._changeEventMode();
	}
	
	return MoveResult.CONTINUE;
};

PlayerTurn._getDefaultCursorPos = function() {
	var i, unit;
	var targetUnit = null;
	var list = PlayerList.getSortieList();
	var count = list.getCount();
	
	for (i = 0; i < count; i++) {
		unit = list.getData(i);
		if (!unit.isWait() && StateControl.isTargetControllable(unit)) { //(unit.getImportance() === ImportanceType.LEADER) {
			targetUnit = unit;
			break;
		}
	}
	
	if (targetUnit === null) {
		targetUnit = list.getData(0);
	}
	
	if (targetUnit !== null) {
		return createPos(targetUnit.getMapX(), targetUnit.getMapY());
	}
	
	return null;
};

// disable the "End Turn" command from the map menu
// in the future, might restore this so that the command removes all player actions
// for the rest of the turn (removes all 0s from the list)
// ideally there'd be a confirm window as well, i.e. ["End all unit's actions? Y/N"]
MapCommand.configureCommands = function(groupArray) {
	var mixer = createObject(CommandMixer);
	
	mixer.pushCommand(MapCommand.TurnEnd, CommandActionType.TURNEND);
	
	mixer.mixCommand(CommandLayoutType.MAPCOMMAND, groupArray, BaseListCommand);
};


MapCommand.TurnEnd = defineObject(BaseListCommand,
{
	openCommand: function() {
		if (root.getBaseScene() === SceneType.FREE) {
			this._saveCursor();
		}
		BWSTurnSystem.endPlayerTurn();
		//TurnControl.turnEnd();
	},
	
	moveCommand: function() {
		return MoveResult.END;
	},
	
	drawCommand: function() {
	},
	
	_saveCursor: function() {
		var playerTurnObject = SceneManager.getActiveScene().getTurnObject();
		
		playerTurnObject.setAutoCursorSave(false);
	}
}
);


// changes to save: by default this show up ALL THE TIME on player phase
// which is no good, we only want before the first action.
// So change the condition to check for any waiting units
SaveScreenLauncher.isLaunchable = function() {
	if (root.getCurrentScene() === SceneType.FREE) {
		
		var playerList = PlayerList.getAliveList();
		var enemyList = EnemyList.getAliveList();
		var allyList = AllyList.getAliveList();
		var list = [playerList, enemyList, allyList]
		var unit, count;
		
		for (i = 0; i < 3; i++) {
			count = list[i].getCount();
			for (j = 0; j < count; j++) {
				unit = list[i].getData(j);
				// if there are ANY waiting units, it is not the start of the turn
				// I guess berserked units could stuff this up though -_-
				if (unit.isWait()) {
					return false;
				}
			}
		}
		
		return true;
		//return !SceneManager.getActiveScene().getTurnObject().isPlayerActioned();
		
	}
	
	return true;
};


// allow you to see rnage of units who are waiting by mousing over

UnitRangePanel._isRangeDrawable = function() {
	if (this._unit === null) {
		return false;
	}
	
	if (PosChecker.getUnitFromPos(this._x, this._y) !== this._unit) {
		return false;
	}
	
/* 	if (this._unit.isWait()) {
		return false;
	} */
	
	return true;
};

// stop turn count from increasing at start of every player action (old 'phase')
BaseTurnLogoFlowEntry.doMainAction = function(isMusic) {
	var startEndType;

	// Count a turn number if the player turn starts up.
	// CHANGE - only do this on turn 1 (increasing from turn 0 to 1 when the map starts)
	if (root.getCurrentSession().getTurnType() === TurnType.PLAYER && root.getCurrentSession().getTurnCount() === 0) {
		
		root.getCurrentSession().setTurnCount(root.getCurrentSession().getTurnCount() + 1);
		
		// Count a relative turn.
		root.getCurrentSession().increaseRelativeTurn();
	}
	
	if (isMusic) {
		this._changeMusic();
	}
	
	startEndType = this._turnChange.getStartEndType();
	if (startEndType === StartEndType.PLAYER_START) {
		// If the player's turn starts up, no auto skip.
		CurrentMap.setTurnSkipMode(false);
	}
	else {
		// If it's the enemy or the ally, check the auto turn skip.
		CurrentMap.setTurnSkipMode(this._isAutoTurnSkip());
	}
	
	CurrentMap.enableEnemyAcceleration(true);
};


// a lot of this shit should only happen on 'new turn' rather than changing phase.
TurnChangeStart.pushFlowEntries = function(straightFlow) {
	// Prioritize the turn display.
	//ONLY do all this shit if it's a new turn, i.e. turn list is equal no total units
	var numPlayer = PlayerList.getControllableList().getCount();
	var numEnemy = EnemyList.getControllableList().getCount();
	var numAlly = AllyList.getControllableList().getCount();
	var totalUnits = numPlayer + numEnemy + numAlly;
	
	
	// if the turn list is empty, start a new turn
	// MOVED HERE
	if (BWSTurnSystem.turnList.length === 0) {
		root.log('starting new turn')
		BWSTurnSystem.newTurn();
		BWSTurnSystem.initialiseList();
	}	
	
	// maybe need another check here for berserked uits etc. 
	// bewcause this is being called too many times
	if (BWSTurnSystem.turnList.length === totalUnits) {// || root.getCurrentSession().getTurnCount() === 0) {
		straightFlow.pushFlowEntry(ReinforcementAppearFlowEntry);
		if (this._isTurnAnimeEnabled()) {
			straightFlow.pushFlowEntry(TurnAnimeFlowEntry); // using an animation (resource location/animations)
		}
		else {
			straightFlow.pushFlowEntry(TurnMarkFlowEntry); // this is what it is by default, i.e. moving image/text
		}
		// this stuff should be done for ALL units now (see below for changes)
		straightFlow.pushFlowEntry(RecoveryAllFlowEntry);
		straightFlow.pushFlowEntry(MetamorphozeCancelFlowEntry);
		straightFlow.pushFlowEntry(StateTurnFlowEntry); // this one already okay
	}

};

RecoveryAllFlowEntry._completeMemberData = function(turnChange) {
	var i, unit, recoveryValue;
	var commandCount = 0;
	var isSkipMode = CurrentMap.isTurnSkipMode();
	var generator = this._dynamicEvent.acquireEventGenerator();
	
	var playerList = PlayerList.getAliveList();
	var enemyList = EnemyList.getAliveList();
	var allyList = AllyList.getAliveList();
	var list = [playerList, enemyList, allyList]//TurnControl.getActorList();
	for (j = 0; j < 3; j++) {
		var count = list[j].getCount();
		for (i = 0 ; i < count; i++) {
			unit = list[j].getData(i);
			
			recoveryValue = this._getRecoveryValue(unit);
			if (recoveryValue > 0) {
				// Recover if HP is reduced.
				if (unit.getHp() < ParamBonus.getMhp(unit)) {
					// Cursor display is always skipped by specifying true.
					generator.locationFocus(unit.getMapX(), unit.getMapY(), true); 
					generator.hpRecovery(unit, this._getTurnRecoveryAnime(), recoveryValue, RecoveryType.SPECIFY, isSkipMode);
					commandCount++;
				}
			}
			else if (recoveryValue < 0) {
				generator.locationFocus(unit.getMapX(), unit.getMapY(), true);
				recoveryValue *= -1;
				recoveryValue = this._arrangeValue(unit, recoveryValue);
				generator.damageHit(unit, this._getTurnDamageAnime(), recoveryValue, DamageType.FIXED, {}, isSkipMode);
				commandCount++;
			}
		}
	}
	
	if (commandCount === 0) {
		return EnterResult.NOTENTER;
	}
	
	return this._dynamicEvent.executeDynamicEvent();
};


MetamorphozeCancelFlowEntry._completeMemberData = function(turnChange) {
	var i, unit, turn, metamorphozeData;
	var commandCount = 0;
	var isSkipMode = CurrentMap.isTurnSkipMode();
	var generator = this._dynamicEvent.acquireEventGenerator();
	var playerList = PlayerList.getAliveList();
	var enemyList = EnemyList.getAliveList();
	var allyList = AllyList.getAliveList();
	var list = [playerList, enemyList, allyList]//TurnControl.getActorList();	
	
		for (j = 0; j < 3; j++) {
			var count = list[j].getCount();
			for (i = 0 ; i < count; i++) {
				unit = list[j].getData(i);
				metamorphozeData = MetamorphozeControl.getMetamorphozeData(unit);
				if (metamorphozeData === null || !(metamorphozeData.getCancelFlag() & MetamorphozeCancelFlag.AUTO)) {
					continue;
				}
				
				turn = MetamorphozeControl.getMetamorphozeTurn(unit);
				if (--turn === 0) {
					generator.locationFocus(unit.getMapX(), unit.getMapY(), true); 
					generator.unitMetamorphoze(unit, {}, MetamorphozeActionType.CANCEL, isSkipMode);
					// Process if the unit who was deactivated acts first.
					generator.wait(10);
					commandCount++;
				}
				
				MetamorphozeControl.setMetamorphozeTurn(unit, turn);
			}
		}
	
	if (commandCount === 0) {
		return EnterResult.NOTENTER;
	}
	
	return this._dynamicEvent.executeDynamicEvent();
};

BerserkFlowEntry._isBerserkTurn = function() {
	var i, unit;
	var playerList = PlayerList.getAliveList();
	var enemyList = EnemyList.getAliveList();
	var allyList = AllyList.getAliveList();
	var list = [playerList, enemyList, allyList]//TurnControl.getActorList();	
	
	// don't need this lol
/* 	if (root.getCurrentSession().getTurnType() !== TurnType.PLAYER) {
		return false;
	}
	 */
	 
	for (j = 0; j < 3; j++) {
		var count = list[j].getCount();
		for (i = 0; i < count; i++) {
			unit = list[j].getData(i);
			if (StateControl.isBadStateOption(unit, BadStateOption.BERSERK)) {
				return true;
			}
			else if (StateControl.isBadStateOption(unit, BadStateOption.AUTO)) {
				return true;
			}
		}
	}
	
	return false;
};


// It's used If the unit who has a state of "Berserk" or "Auto AI" in the player exists.
var PlayerBerserkTurn = defineObject(EnemyTurn,
{
	// can be called on enemy phase now
	_getActorList: function() {
		return PlayerList.getAliveList();//TurnControl.getActorList();
	}, 
	
	
	
	_moveEndEnemyTurn: function() {
		var i, unit;
		//var list = PlayerList.getSortieList();
		var playerList = PlayerList.getAliveList();
		var enemyList = EnemyList.getAliveList();
		var allyList = AllyList.getAliveList();
		var list = [playerList, enemyList, allyList]//TurnControl.getActorList();	
		
		for (j = 0; j < 1; j++) { // j < 3
			var count = list[j].getCount();
			for (i = 0; i < count; i++) {
				unit = list[j].getData(i);
				if (StateControl.isBadStateOption(unit, BadStateOption.BERSERK)) {
					unit.setWait(false);
				}
				else if (StateControl.isBadStateOption(unit, BadStateOption.AUTO)) {
					unit.setWait(false);
				}
			}
		}
		
		CurrentMap.setTurnSkipMode(false);
		
		return MoveResult.END;
	},
	
	_isOrderAllowed: function(unit) {
		if (!EnemyTurn._isOrderAllowed.call(this, unit)) {
			return false;
		}
		
		if (StateControl.isBadStateOption(unit, BadStateOption.BERSERK)) {
			return true;
		}
		
		if (StateControl.isBadStateOption(unit, BadStateOption.AUTO)) {
			return true;
		}
		
		return false;
	}
}
);



// reinforcement stuff.

ReinforcementChecker._checkReinforcementPage = function(posData, arr) {
	var i, pageData, turnCount;
	var turnType = root.getCurrentSession().getTurnType();
	var count = posData.getReinforcementPageCount();
	
	for (i = 0; i < count; i++) {
		pageData = posData.getReinforcementPage(i);
		turnCount = this._getTurnCount(pageData);
		// Check if a condition such as "Start Turn" is satisfied.
		// ^ not anymore! they should appear as soon as the turn starts
		if (pageData.getStartTurn() <= turnCount && pageData.getEndTurn() >= turnCount) {// && turnType === pageData.getTurnType()) {
			// Check if the event condition is satisfied.
			if (pageData.isCondition()) {
				// Appear.
				this._createReinforcementUnit(posData, pageData, arr);
				// also need to update the turn list
				BWSTurnSystem.updateList();
				break;
			}
		}
	}
};


// reinforcements no longer appear here but in TurnChangeStart instead.
TurnChangeEnd.pushFlowEntries = function(straightFlow) {
	// but also do berserk stuff here??
	var numPlayer = PlayerList.getControllableList().getCount();
	var numEnemy = EnemyList.getControllableList().getCount();
	var numAlly = AllyList.getControllableList().getCount();
	var totalUnits = numPlayer + numEnemy + numAlly;
	// turn list is updated before we get here so this check is
	// basically the same as saying if it's about to be a new turn
	// CHANGED NOW UHUHU HU
	if (BWSTurnSystem.turnList.length === 0) {
		straightFlow.pushFlowEntry(BerserkFlowEntry);
		//straightFlow.pushFlowEntry(ReinforcementAppearFlowEntry); // here or TurnChangeStart?
	}
};


// we only want units to remove "wait" upon a whole new turn, not just intermediate phases.
TurnChangeEnd._checkActorList = function() {
	var i, unit;
	var list = TurnControl.getActorList();
	var count = list.getCount();
	
	for (i = 0; i < count; i++) {
		unit = list.getData(i);
		//this._removeWaitState(unit);
		
		unit = FusionControl.getFusionChild(unit);
		if (unit !== null) {
			// Deactivate a wait state of the units who are fused.
			this._removeWaitState(unit);
		}
	}
};



TurnControl.turnEnd = function() {
	// There is a possibility to be called from the event, call getBaseScene, not getCurrentScene.
	if (root.getBaseScene() === SceneType.FREE) {
		if (root.getCurrentSession().getTurnType() === TurnType.PLAYER) {
			// not really sure why but removing this fixes an error
			//SceneManager.getActiveScene().getTurnObject().clearTurnTargetUnit();
		}
		
		SceneManager.getActiveScene().turnEnd();
	}
}

// when the map starts
var TurnChangeMapStart = defineObject(BaseTurnChange,
{
	doLastAction: function() {
		var turnType = TurnType.PLAYER;
		
		if (PlayerList.getSortieList().getCount() > 0) {
			turnType = TurnType.PLAYER;
		}
		else if (EnemyList.getAliveList().getCount() > 0) {
			turnType = TurnType.ENEMY;
		}
		else if (AllyList.getAliveList().getCount() > 0) {
			turnType = TurnType.ALLY;
		}
		
		root.getCurrentSession().setTurnCount(0);
		root.getCurrentSession().setTurnType(turnType);
		// initialise bws turn list here.
		BWSTurnSystem.initialiseList();
		root.log(BWSTurnSystem.turnList);
	},
	
	getStartEndType: function() {
		return StartEndType.MAP_START;
	}
}
);



TurnChangeEnd._startNextTurn = function() {
	var nextTurnType;
	var turnType = root.getCurrentSession().getTurnType();
	
	this._checkActorList();
	
	nextTurnType = BWSTurnSystem.turnList[0];
	//root.log('next turn type is ' + nextTurnType);
	// skip is turned off if the player is up next (otherwise it stays
	// on for the rest of the turn and messes with the markers)
	if (nextTurnType === TurnType.PLAYER) {
		CurrentMap.setTurnSkipMode(false);
	}
	root.getCurrentSession().setTurnType(nextTurnType);
};

// in case an attacking player dies, make change here
MapSequenceCommand._doLastAction = function() {
	var i;
	var unit = null;
	var list = PlayerList.getSortieList();
	var count = list.getCount();
	
	// Check it because the unit may not exist by executing a command.
	for (i = 0; i < count; i++) {
		if (this._targetUnit === list.getData(i)) {
			unit = this._targetUnit;
			break;
		}
	}	
	
	// Check if the unit doesn't die and still exists.
	if (unit !== null) {
		if (this._unitCommandManager.getExitCommand() !== null) {
			if (!this._unitCommandManager.isRepeatMovable()) {
				// If move again is not allowed, don't move again.
				this._targetUnit.setMostResentMov(ParamBonus.getMov(this._targetUnit));
			}
			
			// Set the wait state because the unit did some action.
			this._parentTurnObject.recordPlayerAction(true);
			return 0;
		}
		else {
			// Get the position and cursor back because the unit didn't act.
			this._parentTurnObject.setPosValue(unit);
		}	
		
		// Face forward.
		unit.setDirection(DirectionType.NULL);
	}
	else {
		this._parentTurnObject.recordPlayerAction(true);
		// if unit is dead, shift list
		BWSTurnSystem.shiftList();
		root.log(BWSTurnSystem.turnList);			
		return 1;
	}

	
	return 2;
};


ReactionFlowEntry._completeMemberData = function(playerTurn) {
	var skill;
	
	// shift turn list (remove 1st)
	// moving the thing here rather than in unitwaitflowentry
	// note this will probably screw with move again skills, might be best to restructure this
	// so that it checks for the skill proc first, otherwise we shift list and NOTENTER
	// BUT only if not berserked since they don't use up turns
	if (StateControl.isTargetControllable(this._targetUnit)) {
		BWSTurnSystem.shiftList();
		root.log(BWSTurnSystem.turnList);			
	}
	// BUT there is a change of a berserked ally killing something which means we'd
	// have to update the list, so do that
/* 	else {
		root.log('oh no unctrollable update')
		BWSTurnSystem.updateList();
	} */
	
	
	
	if (this._targetUnit.getHp() === 0) {
		return EnterResult.NOTENTER;
	}
	
	// Action again doesn't occur when it's unlimited action.
	if (Miscellaneous.isPlayerFreeAction(this._targetUnit)) {
		return EnterResult.NOTENTER;
	}
	
	if (this._targetUnit.getReactionTurnCount() !== 0) {
		return EnterResult.NOTENTER;
	}
	
	skill = SkillControl.getBestPossessionSkill(this._targetUnit, SkillType.REACTION);
	if (skill === null) {
		return EnterResult.NOTENTER;
	}
	
	if (!Probability.getInvocationProbabilityFromSkill(this._targetUnit, skill)) {
		return EnterResult.NOTENTER;
	}
	
	this._skill = skill;
	
	this._startReactionAnime();
	
	return EnterResult.OK;
};

// changes to enemy action builder
// main thing here is that units who don't move now "wait" as an action
// rather than skipping their turn and doing nothing (which would screw up the turn order list)
// since there's changes to a lot of functions in AutoActionBuilder I'm lazily copying the whole thing across
var AutoActionBuilder = {
	buildApproachAction: function(unit, autoActionArray) {
		var combination;
		
		// Get the best combination in the unit who can attack from the current position.
		combination = CombinationManager.getApproachCombination(unit, true);
		if (combination === null) {
			// Search the opponent to widen the range because no unit who can be attacked from the current position exists.
			// However, before that, check if the attack within a range was set.
			if (unit.getAIPattern().getApproachPatternInfo().isRangeOnly()) {
				// Do nothing because attack is set only within a range.
				// There is no problem because it has already checked that it's impossible to attack within a range. 
				return this._buildEmptyAction(unit, autoActionArray, combination);
			}
			else {
				// Get which enemy to be targeted because there is no opponent who can be attacked at the current position.
				combination = CombinationManager.getEstimateCombination(unit);
				if (combination === null) {
					return this._buildEmptyAction(unit, autoActionArray, combination);
				}
				else {
					// Set the target position to move.
					this._pushMove(unit, autoActionArray, combination);
					
					// Set it so as to wait after move.
					this._pushWait(unit, autoActionArray, combination);
				}
			}
		}
		else {
			this._pushGeneral(unit, autoActionArray, combination);
		}
		
		return true;
	},
	
	buildWaitAction: function(unit, autoActionArray) {
		var combination;
		var isWaitOnly = unit.getAIPattern().getWaitPatternInfo().isWaitOnly();
		
		if (isWaitOnly) {
			return this._buildEmptyAction(unit, autoActionArray, combination);
		}
		else {
			// Get the best combination in the unit who can attack from the current position.
			combination = CombinationManager.getWaitCombination(unit);
			if (combination === null) {
				// Do nothing because it cannot attack.
				return this._buildEmptyAction(unit, autoActionArray, combination);
			}
			else {
				this._pushGeneral(unit, autoActionArray, combination);
			}
		}
		
		return true;
	},
	
	buildMoveAction: function(unit, autoActionArray) {
		var x, y, targetUnit;
		var combination = null;
		var patternInfo = unit.getAIPattern().getMovePatternInfo();
		
		if (patternInfo.getMoveGoalType() === MoveGoalType.POS) {
			x = patternInfo.getMoveGoalX();
			y = patternInfo.getMoveGoalY();
		}
		else {
			targetUnit = patternInfo.getMoveGoalUnit();
			if (targetUnit === null) {
				return this._buildEmptyAction(unit, autoActionArray, combination);
			}
			
			x = targetUnit.getMapX();
			y = targetUnit.getMapY();
		}
		
		// Check if it has already reached at goal.
		if (unit.getMapX() === x && unit.getMapY() === y) {
			// Attack if it can attack.
			if (patternInfo.getMoveAIType() === MoveAIType.APPROACH) {
				combination = CombinationManager.getWaitCombination(unit);
				if (combination !== null) {
					this._pushGeneral(unit, autoActionArray, combination);
					return true;
				}
			}
		}
		else {
			combination = CombinationManager.getMoveCombination(unit, x, y, patternInfo.getMoveAIType());
			if (combination === null) {
				return this._buildEmptyAction(unit, autoActionArray, combination);
			}
			
			if (combination.item !== null || combination.skill !== null) {
				this._pushGeneral(unit, autoActionArray, combination);
				return true;
			}
			else {
				this._pushMove(unit, autoActionArray, combination);
			}
		}
		
		if (combination !== null) {
			this._pushWait(unit, autoActionArray, combination);
		}
		
		return true;
	},
	
	buildCustomAction: function(unit, autoActionArray, keyword) {
		return false;
	},
	
	_buildEmptyAction: function(unit, autoActionArray, combination) {
		// we need enemies which do nothing to wait.
		//this._pushMove(unit, autoActionArray, combination);
		this._pushWait(unit, autoActionArray, null);
	},
	
	_pushGeneral: function(unit, autoActionArray, combination) {
		// Set the target position to move.
		this._pushMove(unit, autoActionArray, combination);
		
		if (combination.skill !== null) {
			this._pushSkill(unit, autoActionArray, combination);
		}
		else if (combination.item !== null) {
			if (combination.item.isWeapon()) {
				this._pushAttack(unit, autoActionArray, combination);
			}
			else {
				this._pushItem(unit, autoActionArray, combination);
			}
		}
		else {
			this._pushCustom(unit, autoActionArray, combination);
		}
		
		this._pushWait(unit, autoActionArray, combination);
	},
	
	_pushMove: function(unit, autoActionArray, combination) {
		var autoAction;
		// check here... if combination is null, then update it somehow...
		
		this._pushScroll(unit, autoActionArray, combination);
		
		if (combination.cource.length === 0) {
			return;
		}
		
		autoAction = createObject(MoveAutoAction);
		autoAction.setAutoActionInfo(unit, combination);
		autoActionArray.push(autoAction);
	},
	
	_pushAttack: function(unit, autoActionArray, combination) {
		var autoAction = createObject(WeaponAutoAction);
		
		// if we push scroll here the map will scroll to the attacked unit
		// (may or may not be desirable?)
		this._pushScroll(unit, autoActionArray, combination);
		
		autoAction.setAutoActionInfo(unit, combination);
		autoActionArray.push(autoAction);
	},
	
	_pushItem: function(unit, autoActionArray, combination) {
		var autoAction = createObject(ItemAutoAction);
		
		autoAction.setAutoActionInfo(unit, combination);
		autoActionArray.push(autoAction);
	},
	
	_pushSkill: function(unit, autoActionArray, combination) {
		var autoAction = createObject(SkillAutoAction);
		
		autoAction.setAutoActionInfo(unit, combination);
		autoActionArray.push(autoAction);
	},
	
	_pushWait: function(unit, autoActionArray, combination) {
		var autoAction = createObject(WaitAutoAction);
		
		// don't do this anymore since we scroll to unit beforehand
		//this._pushScroll(unit, autoActionArray, combination);
		autoAction.setAutoActionInfo(unit, combination);
		autoActionArray.push(autoAction);
	},
	
	_pushScroll: function(unit, autoActionArray, combination) {
		var autoAction;
		
		if (CurrentMap.isCompleteSkipMode()) {
			return;
		}
		
		// change this, the first one causes visual glitches
		if (false) {//EnvironmentControl.getScrollSpeedType() === SpeedType.HIGH) {
			MapView.setScroll(unit.getMapX(), unit.getMapY());
		}
		else {
			autoAction = createObject(ScrollAutoAction);
			autoAction.setAutoActionInfo(unit, combination);
			autoActionArray.push(autoAction);
		}
	},
	
	_pushCustom: function(unit, autoActionArray, combination) {
	}
};



// this is now called by _pushWait as well. (for enemies who don't move)
// in this case combination is null so we need to make an empty _moveCource (lol spelling)
// don't really know why it works but it does lol
ScrollAutoAction.setAutoActionInfo = function(unit, combination) {
	//root.log('we setting ScrollAutoAction info')
	this._unit = unit;
	if (combination !== null) {
		this._moveCource = combination.cource;
	}
	else {
		this._moveCource = [];
		}
	this._mapLineScroll = createObject(MapLineScroll);
	this._simulateMove = createObject(SimulateMove);
};

// scroll smoothly when the auto action cursor is made
// ideally we still want it to scroll BEFORE the cursor is made...
AutoActionCursorsetAutoActionPos = function(x, y, isScroll) {
	this._lockonCursor = createObject(LockonCursor);
	this._lockonCursor.setPos(x, y);
	
	// When using the item, isScroll is false.
	if (isScroll) {
		if (!MapView.isVisible(x, y)) {
			// Scroll if the target position is out of screen.
			MapView.setScroll(x, y);
			//root.log('fuckthis')
			//MapLineScroll.startLineScroll(x, y);
		}
	}
	// want to call this repeatedly...
	// MapLineScroll.moveLineScroll();
};


// changes to EnemyTurn class
// again there's quite a few changes so I've copied the who thing across and made changes
// could probably still reduce it to aliases etc.

// first we add a new EnemyTurnMode for the cursor to briefly focus on enemies before they move
// plus one or scrolling to an enemy before that
var EnemyTurnMode = {
	TOP: 1,
	PREACTION: 2,
	AUTOACTION: 3,
	AUTOEVENTCHECK: 4,
	END: 5,
	IDLE: 6,
	CURSORSHOW: 7,
	MAPSCROLL: 8
};


var EnemyTurn = defineObject(BaseTurn,
{
	_orderIndex: 0,
	_orderUnit: null,
	_autoActionIndex: 0,
	_autoActionArray: null,
	_straightFlow: null,
	_idleCounter: null,
	_eventChecker: null,
	_orderCount: 0,
	_orderMaxCount: 0,
	_autoActionCursor: null,
	_autoActionScroll: null,

	
	openTurnCycle: function() {
		this._prepareTurnMemberData();
		this._completeTurnMemberData();
		
		AIFirstStage_UnitSupportStatusTable.resetTable();
		AIFirstStage_TargetUnitSupportStatusTable.resetTable();
	},
	
	moveTurnCycle: function() {
		var mode = this.getCycleMode();
		var result = MoveResult.CONTINUE;
		
		//root.log('enemy turn mode: ' + mode)
		//root.log(root.getCurrentSession().getScrollPixelX() + '/' + root.getCurrentSession().getScrollPixelY())
		
		// If _isSkipAllowed returns true, check the skip.
		// With this, the skip at the battle doesn't affect the skip for turn.
		if (this._isSkipAllowed() && InputControl.isStartAction()) {
			CurrentMap.setTurnSkipMode(true);
		}
		
		if (mode === EnemyTurnMode.TOP) {
			result = this._moveTop();
		}
		else if (mode === EnemyTurnMode.AUTOACTION) {
			result = this._moveAutoAction();
		}
		else if (mode === EnemyTurnMode.PREACTION) {
			result = this._movePreAction();
		}
		else if (mode === EnemyTurnMode.AUTOEVENTCHECK) {
			result = this._moveAutoEventCheck();
		}
		else if (mode === EnemyTurnMode.END) {
			result = this._moveEndEnemyTurn();
		}
		else if (mode === EnemyTurnMode.IDLE) {
			result = this._moveIdle();
		}
		else if (mode === EnemyTurnMode.CURSORSHOW) {
			result = this._moveCursorShow();
		}
		else if (mode === EnemyTurnMode.MAPSCROLL) {
			result = this._moveMapScroll();
		}

		
		return result;
	},
	
	drawTurnCycle: function() {
		var mode = this.getCycleMode();
		
		MapLayer.drawUnitLayer();
		MapParts.BWSTurnWindow.drawMapParts();
		
		if (mode === EnemyTurnMode.PREACTION) {
			this._drawPreAction();
		}
		else if (mode === EnemyTurnMode.AUTOACTION) {
			this._drawAutoAction();
		}
		else if (mode === EnemyTurnMode.AUTOEVENTCHECK) {
			this._drawAutoEventCheck();
		}
		
		if (this._isSkipProgressDisplayable()) {
			this._drawProgress();
		}
	},
	
	getOrderUnit: function() {
		return this._orderUnit;
	},
	
	_prepareTurnMemberData: function() {
		this._orderIndex = 0;
		this._orderUnit = null;
		this._autoActionIndex = 0;
		this._autoActionArray = [];
		this._straightFlow = createObject(StraightFlow);
		this._idleCounter = createObject(IdleCounter);
		this._eventChecker = createObject(EventChecker);
	},
	
	_completeTurnMemberData: function() {
		this._straightFlow.setStraightFlowData(this);
		this._pushFlowEntries(this._straightFlow);
		
		this._resetOrderMark();
		this.changeCycleMode(EnemyTurnMode.TOP);
		this._autoActionCursor = createObject(AutoActionCursor);
		this._autoActionScroll = createObject(ScrollAutoAction);
		
		// There is a possibility that the reinforcements appear when the player's turn ends,
		// execute the marking when the enemy's turn starts.
		MapLayer.getMarkingPanel().updateMarkingPanel();
	},
	
	_checkNextOrderUnit: function() {
		var i, unit;
		var list = this._getActorList();
		var count = list.getCount();
		
		var attackerList = this._getAttackerList();
		var attackerCount = attackerList.length;
		
		// we now prioritise enemies who can attack over those who can't
		// they will move first, but still in database order otherwise
		// go through the attacker list first, then the full list
		for (i = 0; i < attackerCount; i++) {
			unit = attackerList[i];//.getData(i);
			if (!this._isOrderAllowed(unit)) {
				continue;
			}
			
			if (unit.getOrderMark() === OrderMarkType.FREE) {
				this._orderCount++;
				unit.setOrderMark(OrderMarkType.EXECUTED);
				return unit;
			}
		}
		
		for (i = 0; i < count; i++) {
			unit = list.getData(i);
			if (!this._isOrderAllowed(unit)) {
				continue;
			}
			
			if (unit.getOrderMark() === OrderMarkType.FREE) {
				this._orderCount++;
				unit.setOrderMark(OrderMarkType.EXECUTED);
				return unit;
			}
		}
		
		return null;
	},
	
	// function to create a list of enemies who can attack a target.
	_getAttackerList: function() {
		var i, unit;
		var list = this._getActorList();
		var count = list.getCount();
		var attackerList = []; // basic bitch array since idk how to use DataList
		
		for (i = 0; i < count; i++) {
			unit = list.getData(i);
			if (!this._isOrderAllowed(unit)) {
				continue;
			}
			combination = CombinationManager.getApproachCombination(unit, true);
			
			if (unit.getOrderMark() === OrderMarkType.FREE && combination !== null) {
				attackerList.push(unit)
				//this._orderCount++;
				//unit.setOrderMark(OrderMarkType.EXECUTED);
				//return unit;
			}
		}
		return attackerList;
	},
	
	_isOrderAllowed: function(unit) {
		if (unit.isActionStop() || unit.isWait() || unit.isInvisible() || StateControl.isBadStateOption(unit, BadStateOption.NOACTION)) {
			return false;
		}
		
		return true;
	},
	
	_resetOrderMark: function() {
		var i, unit;
		var list = this._getActorList();
		var count = list.getCount();
		
		// Set a state in which nobody moves. 
		for (i = 0; i < count; i++) {
			unit = list.getData(i);
			unit.setOrderMark(OrderMarkType.FREE);
		}
		
		this._orderMaxCount = count;
	},
	
	_moveTop: function() {
		var result;
		
		for (;;) {
			// Change a mode because the event occurs.
			if (this._eventChecker.enterEventChecker(root.getCurrentSession().getAutoEventList(), EventType.AUTO) === EnterResult.OK) {
				this.changeCycleMode(EnemyTurnMode.AUTOEVENTCHECK);
				return MoveResult.CONTINUE;
			}
			
			if (GameOverChecker.isGameOver()) {
				GameOverChecker.startGameOver();
			}
			
			// When the event is executed and if the scene itself has been changed,
			// don't continue. For instance, when the game is over etc.
			if (root.getCurrentScene() !== SceneType.FREE) {
				return MoveResult.CONTINUE;
			}
			
			// Get the unit who should move.
			this._orderUnit = this._checkNextOrderUnit();
			
			if (this._orderUnit === null) {
				// No more enemy exists, so enter to end the return.
				this.changeCycleMode(EnemyTurnMode.END);
				break;
			}
			
			// due to some probably dodgy code we can end up with a player unit in here
			// this doesn't really matter but sometimes the "cursor"/highlight shows on player
			// units after skipping enemy phase, so check that it isn't a player
			if (this._orderUnit.getUnitType() === UnitType.PLAYER) {
				this._autoActionCursor.endAutoActionCursor(); // get rid of cursor
				this.changeCycleMode(EnemyTurnMode.END);
				break;				
			}
			
			else {
				// It's possible to refer to the control character of \act at the event.
				
				//root.log('unit name: ' + this._orderUnit.getName())
	
				root.getCurrentSession().setActiveEventUnit(this._orderUnit);
				
				// start scrolling to enemy
				this._autoActionScroll.setAutoActionInfo(this._orderUnit, null);
				this._autoActionScroll.enterAutoAction();
				
				// set the position of the auto cursor
				this._autoActionCursor.setAutoActionPos(this._orderUnit.getMapX(), this._orderUnit.getMapY(), true);
				
				
				
				this._straightFlow.resetStraightFlow();
				
				// Execute a flow of PreAction.
				// PreAction is an action before the unit moves or attacks,
				// such as ActivePatternFlowEntry.
				result = this._straightFlow.enterStraightFlow();	



				// condition here...?
				// if we're skipping, create autoaction thing now to prevent an error
/* 				if (this._isSkipMode()) {
					this._createAutoAction();
					this._startAutoAction();
				}				
				 */
							
				
				if (result === EnterResult.NOTENTER) {
					

					
 					if (this._startAutoAction()) {
						// Change a mode because graphical action starts.
						//this.changeCycleMode(EnemyTurnMode.AUTOACTION);
						// instead of going to autoaction, we first go to cursorshow first
						// which then changes to autoaction (don't really understand but hey it works)
						//this.changeCycleMode(EnemyTurnMode.CURSORSHOW);
						this.changeCycleMode(EnemyTurnMode.MAPSCROLL);
						break; 
					}
					
					
					// If this method returns false, it means to loop, so the next unit is immediately checked.
					// If there are many units, looping for a long time and the busy state occurs.
					if (this._isSkipProgressDisplayable()) {
						this.changeCycleMode(EnemyTurnMode.TOP);
						break;
					}
				}
				else {
					// Change a mode because PreAction exists.
					this.changeCycleMode(EnemyTurnMode.PREACTION);
					break;
				}
			}
		}
		
		return MoveResult.CONTINUE;
	},
	
	_moveAutoAction: function() {
		// Check if action which is identified with this._autoActionIndex has ended.
		if (this._autoActionArray[this._autoActionIndex].moveAutoAction() !== MoveResult.CONTINUE) {
			if (!this._countAutoActionIndex()) {
				// removing this line gets rid of an error which happens when a stationary
				// enemy moves after a mobile one (don't really know why it fixes it but eh)
				//this._autoActionCursor.endAutoActionCursor();
				this._changeIdleMode(EnemyTurnMode.TOP, this._getIdleValue());
			}
		}
		
		return MoveResult.CONTINUE;
	},
	
	_movePreAction: function() {
		if (this._straightFlow.moveStraightFlow() !== MoveResult.CONTINUE) {
			if (this._startAutoAction()) {
				// Change a mode because graphical action starts.
				this.changeCycleMode(EnemyTurnMode.AUTOACTION);
			}
			else {
				this.changeCycleMode(EnemyTurnMode.TOP);
			}
		}
		
		return MoveResult.CONTINUE;
	},
	
	_moveAutoEventCheck: function() {
		if (this._eventChecker.moveEventChecker() !== MoveResult.CONTINUE) {
			if (!this._isSkipMode()) {
				MapLayer.getMarkingPanel().updateMarkingPanel();
			}
			this.changeCycleMode(EnemyTurnMode.TOP);
		}
		
		return MoveResult.CONTINUE;
	},
	
	_moveEndEnemyTurn: function() {
		TurnControl.turnEnd();
		MapLayer.getMarkingPanel().updateMarkingPanel();
		this._orderCount = 0;
		return MoveResult.CONTINUE;
	},
	
	_moveIdle: function() {
		var nextmode;
		
		if (this._idleCounter.moveIdleCounter() !== MoveResult.CONTINUE) {
			nextmode = this._idleCounter.getNextMode();
			this.changeCycleMode(nextmode);
		}
		
		return MoveResult.CONTINUE;
	},
	
	_moveCursorShow: function() {
		var isSkipMode = this._isSkipMode();
		
		if (isSkipMode || this._autoActionCursor.moveAutoActionCursor() !== MoveResult.CONTINUE) {
			if (isSkipMode) {
				
				this._autoActionCursor.endAutoActionCursor();
			}
			
			// move on to autoaction ehich is next
			//this._startAutoAction();
			this.changeCycleMode(EnemyTurnMode.AUTOACTION);
			
		}
		
		return MoveResult.CONTINUE;
	},
	
	_moveMapScroll: function() {
		var isSkipMode = this._isSkipMode();
		
		if (isSkipMode || this._autoActionScroll.moveAutoAction() !== MoveResult.CONTINUE) {
			if (isSkipMode) {
				//this._autoActionScroll.endAutoActionCursor();

				// below line is kind of weird...but it prevents a fatal bug that would occur
				// if you skip during the map scrolling (not sure what was causing it tbh)
				this._completeTurnMemberData();
				
				
				this.changeCycleMode(EnemyTurnMode.AUTOACTION);
			}
			
			else {
				// move on to autoaction ehich is next
				this._startAutoAction();
				this.changeCycleMode(EnemyTurnMode.CURSORSHOW);
			}
			

		}
		
		return MoveResult.CONTINUE;
	},	
	

			
	_drawPreAction: function() {
		this._straightFlow.drawStraightFlow();
	},
	
	_drawAutoAction: function() {
		this._autoActionArray[this._autoActionIndex].drawAutoAction();
	},
	
	_drawAutoEventCheck: function() {
		this._eventChecker.drawEventChecker();
	},
	
 	_drawCursorShow: function() {
		this._autoActionCursor.drawAutoActionCursor();
	},
	
 	_drawMapScroll: function() {
		this._autoActionScroll.drawAutoAction();
	},	
	
	_drawProgress: function() {
		var n;
		var textui = root.queryTextUI('single_window');
		var pic  = textui.getUIImage();
		var width = 130;
		var height = 74;
		var x = LayoutControl.getCenterX(-1, width);
		var y = LayoutControl.getCenterY(-1, height);
		
		if (this._orderCount >= this._orderMaxCount) {
			n = 100;
		}
		else {
			n = Math.floor(100 * (this._orderCount / this._orderMaxCount));
		}
		
		WindowRenderer.drawStretchWindow(x, y, width, height, pic);
		
		x += DefineControl.getWindowXPadding();
		y += DefineControl.getWindowYPadding();
		
		TextRenderer.drawText(x, y, StringTable.SkipProgress, -1, textui.getColor(), textui.getFont());
		NumberRenderer.drawNumber(x + 44, y + 20, n);
		TextRenderer.drawKeywordText(x + 58, y + 21, StringTable.SignWord_Percent, -1, textui.getColor(), textui.getFont());
	},
	
	_isActionAllowed: function() {
		// Call createAIPattern only here so as always to return the same pattern at the subsequent getAIPattern.
		// At this method to check the pattern every time, if the probability is condition, the pattern which can be gotten isn't unequal.
		// If there is no allowed page even one page, return null. 
		return this._orderUnit.createAIPattern() !== null;
	},
	
	_startAutoAction: function() {
		var result;
		
		if (!this._isActionAllowed()) {
			return false;
		}
			
		// If AutoAction cannot be created, check the next unit.
		if (!this._createAutoAction()) {
			return false;
		}
		
		while (this._autoActionIndex < this._autoActionArray.length) {
			result = this._autoActionArray[this._autoActionIndex].enterAutoAction();
			if (result === EnterResult.OK) {
				//root.log('we return true')
				return true;
			}
			
			this._autoActionIndex++;
		}
		
		this._autoActionIndex = 0;
		
		// Return false means to check the next unit immediately.
		return false;
	},
	
	_countAutoActionIndex: function() {
		var result;
		
		// Increase the index for the next action.
		this._autoActionIndex++;
		
		while (this._autoActionIndex < this._autoActionArray.length) {
			result = this._autoActionArray[this._autoActionIndex].enterAutoAction();
			if (result === EnterResult.OK) {
				return true;
			}
			
			this._autoActionIndex++;
		}
		
		this._autoActionIndex = 0;
		
		return false;
	},
	
	_createAutoAction: function() {
		var keyword;
		var patternType = this._orderUnit.getAIPattern().getPatternType();
		
		this._autoActionArray = [];
		
		if (patternType === PatternType.APPROACH) {
			AutoActionBuilder.buildApproachAction(this._orderUnit, this._autoActionArray);
		}
		else if (patternType === PatternType.WAIT) {
			AutoActionBuilder.buildWaitAction(this._orderUnit, this._autoActionArray);
		}
		else if (patternType === PatternType.MOVE) {
			AutoActionBuilder.buildMoveAction(this._orderUnit, this._autoActionArray);
		}
		else if (patternType === PatternType.CUSTOM) {
			keyword = this._orderUnit.getAIPattern().getCustomKeyword();
			AutoActionBuilder.buildCustomAction(this._orderUnit, this._autoActionArray, keyword);
		}
		
		return true;
	},
	
	_getActorList: function() {
		return TurnControl.getActorList();
	},
	
	_isSkipMode: function() {
		return CurrentMap.isTurnSkipMode();
	},
	
	_isSkipProgressDisplayable: function() {
		return this._isSkipMode() && DataConfig.isEnemyTurnOptimized();
	},
	
	_getIdleValue: function() {
		return 10;
	},
	
	_isSkipAllowed: function() {
		var mode = this.getCycleMode();
		
		if (mode === EnemyTurnMode.AUTOACTION) {
			return this._autoActionArray[this._autoActionIndex].isSkipAllowed();
		}
		
		return true;
	},
	
	_changeIdleMode: function(nextmode, value) {
		this._idleCounter.setIdleInfo(value, nextmode);
		this.changeCycleMode(EnemyTurnMode.IDLE);
	},
	
	_pushFlowEntries: function(straightFlow) {
		straightFlow.pushFlowEntry(ActivePatternFlowEntry);
	}
}
);