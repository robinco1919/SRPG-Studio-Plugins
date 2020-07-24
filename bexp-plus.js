/*--------------------------------------------------------------------------
BEXP Plus
Created by robinco

Adds extra functionality to how Bonus EXP works.
* Change how stat gains work for BEXP levels
* Change the formula for how much BEXP is required to level up
* Set whether capped stats can be raised

24/07/2020 Initial release
--------------------------------------------------------------------------*/


// Type of levels
// 0 = fixed (same number of stat gains each level)
// 1 = semi-fixed (number of stat gains dependent on total growths)
//     e.g. if total growth rate is 270% then the unit will have a 
//     70% chance of getting 3 stats and a 30% chance of getting 2
// 2 = random (completely random, like normal level ups)
var BEXP_LEVEL_TYPE = 0;

// The number of stats to increase each level (only for fixed mode)
var FIXED_STATS = 3;

// Minimum BEXP addable. Might be good to set this above 1 to prevent abusing
// e.g. if it costs 140 BEXP to level up, then adding in increments of 1 will only cost 100
var MIN_BEXP = 10;

// Whether or not to raise stats already capped
var RAISE_CAPS = false;

// Reduces the amount of BEXP required for units with "Experience Up" skill
var BEXP_DISCOUNT = true;


// This is the function that controls the amount of BEXP needed to level up.
// Refer to this._unit if the rate is changed for each unit.
// If the rate is 1, 1 bonus can grant 1 Exp.
// If the rate is 10, 10 bonus can grant 1 Exp.

// There are two versions given below: 
// the first is from my own game (level does not reset upon prootion)
// and the second (commented out) is from FE10 (levels resets upon promotion)
// Feel free to mess around with the formulas to find something you like.

BonusInputWindow._getRate = function() {
	
	var rate = 0.9 + 0.1 * this._unit.getLv();
	
	// Double required BEXP for high/promoted classes
	if (this._unit.getClass().getClassRank() === ClassRank.HIGH) {
		rate *= 2;
	}
	
	// If the unit has an Experience Up skill and BEXP_DISCOUNT is true,
	// adjust the required rate
	if (BEXP_DISCOUNT) {		
		var skill = SkillControl.getBestPossessionSkill(this._unit, SkillType.GROWTH);
		if (skill !== null) {
			factor = skill.getSkillValue() / 100;
			rate /= factor;
		}
	}
	
	return rate * root.getUserExtension().getExperienceRate()
};

/*
BonusInputWindow._getRate = function() {
	
	// Treat level as if 20 higher for high/promoted classes
	if (this._unit.getClass().getClassRank() === ClassRank.HIGH) {
		var rate = 0.5 + 0.5 * (this._unit.getLv() + 20);
	}
	else {
		var rate = 0.5 + 0.5 * this._unit.getLv();
	}
	
	// If the unit has an Experience Up skill and BEXP_DISCOUNT is true,
	// adjust the required rate
	if (BEXP_DISCOUNT) {		
		var skill = SkillControl.getBestPossessionSkill(this._unit, SkillType.GROWTH);
		if (skill !== null) {
			factor = skill.getSkillValue() / 100;
			rate /= factor;
		}
	}
	
	return rate * root.getUserExtension().getExperienceRate()
};
*/


/*--------------------------------------------------------------------------
// Rest of the code
--------------------------------------------------------------------------*/

BonusInputWindow.setUnit = function(unit) {
	var bonus = root.getMetaSession().getBonus();
	
	this._unit = unit;
	this._isMaxLv = unit.getLv() === Miscellaneous.getMaxLv(unit);
	
	if (this._isExperienceValueAvailable()) {
		// At a rate of 10 with 500 bonus, a maximum of 50 Exp can be gained.
		this._max = Math.floor(bonus / this._getRate());
		if (this._max > DefineControl.getBaselineExperience()) {
			this._max = DefineControl.getBaselineExperience();
		}
		
		this._exp = MIN_BEXP;
		this.changeCycleMode(BonusInputWindowMode.INPUT);
	}
	else {
		this._exp = -1;
		this.changeCycleMode(BonusInputWindowMode.NONE);
	}
};

BonusInputWindow.getWindowWidth = function() {
	return this.getCycleMode() === BonusInputWindowMode.INPUT ? 160 : 260;
},


BonusInputWindow._moveInput = function() {
	var inputType;
	
	if (InputControl.isSelectAction()) {
		this._changeBonus();
		return MoveResult.END;
	}
	
	if (InputControl.isCancelAction()) {
		this._cancelExp();
		return MoveResult.END;
	}
	
	inputType = this._commandCursor.moveCursor();
	if (inputType === InputType.UP || MouseControl.isInputAction(MouseType.UPWHEEL)) {
		if (++this._exp > this._max) {
			this._exp = MIN_BEXP;
		}
	}
	else if (inputType === InputType.DOWN || MouseControl.isInputAction(MouseType.DOWNWHEEL)) {
		if (--this._exp < MIN_BEXP) {
			this._exp = this._max;
		}
	}
	
	return MoveResult.CONTINUE;
};
	
	
BonusInputWindow._drawInput = function(x, y) {
	NumberRenderer.drawAttackNumberCenter(x + 35, y, this._exp);
	NumberRenderer.drawNumber(x + 125, y, this._exp * this._getRate());
	TextRenderer.drawText(x + 65, y + 3, 'Cost:', 100, this.getWindowTextUI().getColor(), this.getWindowTextUI().getFont());	
	this._commandCursor.drawCursor(x + 5, y, true, this._getCursorPicture());
};
	
	
// Complete overwrite of RestrictedExperienceControl
var RestrictedExperienceControl = {
	obtainExperience: function(unit, getExp) {
		var i, count, objectArray;
		var sum = 0;
		
		if (!ExperienceControl._addExperience(unit, getExp)) {
			return null;
		}
		
		objectArray = this._createObjectArray(unit);
		count = objectArray.length;
		for (i = 0; i < count; i++) {
			if (objectArray[i].value !== 0) {
				sum++;
			}
		}
		
		// Only 'sort' for fixed/semi-fixed modes
		if (BEXP_LEVEL_TYPE != 2) {
			objectArray = this._sortObjectArray(objectArray, sum, unit);
		}
		
		return this._getGrowthArray(objectArray);
	},
	
	_sortObjectArray: function(objectArray, sum, unit) {
		var i, obj;
		var n = 0;
		var count = objectArray.length;	
		var max = this._getMax(unit);
		var uncap = this._getUncappedParams(unit);
	
		max = Math.min(max, uncap);
		
		// Sort in descending order of the growth rate.
		this._sort(objectArray);
	
		if (sum > max) {
			// There are too many parameters grown, so reduce them.
			// Disable parameters which can grow easily first.
			for (i = 0; i < count; i++) {
				obj = objectArray[i];
				if (obj.value === 0) {
					continue;
				}
				
				obj.value = 0;
				if (++n == sum - max) {
					break;
				}
			}
		}
		else if (sum < max) {
			// There aren't many parameters grown, so increase them.
			// Make parameters, which can grow easily, grow first.
			for (i = 0; i < count; i++) {
				obj = objectArray[i];
				if (obj.value !== 0) {
					continue;
				}
				
				obj.value = ExperienceControl._getGrowthValue(100);
				if (++n == max - sum) {
					break;
				}
			}
		}
		
		return objectArray;
	},
	
	_getGrowthArray: function(objectArray) {
		var i, count, obj;
		var growthArray = [];
		
		count = objectArray.length;
		for (i = 0; i < count; i++) {
			growthArray[i] = 0;
		}
		
		for (i = 0; i < count; i++) {
			obj = objectArray[i];
			if (obj.value !== 0) {	
				growthArray[obj.index] = obj.value;
			}
		}
		
		return growthArray;
	},
	
	_createObjectArray: function(unit) {
		var i, obj;
		var count = ParamGroup.getParameterCount();
		var objectArray = [];
		var weapon = ItemControl.getEquippedWeapon(unit);
		
		for (i = 0; i < count; i++) {
            obj = {};
            obj.index = i;
            if (!RAISE_CAPS && ParamGroup.getClassUnitValue(unit, i) == ParamGroup.getMaxValue(unit, i)) {
                obj.percent = 0;
            }
            else {
                obj.percent = ParamGroup.getGrowthBonus(unit, i) + ParamGroup.getUnitTotalGrowthBonus(unit, i, weapon);
            }
            obj.value = ExperienceControl._getGrowthValue(obj.percent);
            // For the parameters having the same growth rate, the priority of growth is determined by random numbers.
            obj.rand = root.getRandomNumber() % count;
            
            objectArray[i] = obj;
		}
		
		return objectArray;
	},
	
	_sort: function(arr) {
		arr.sort(
			function(obj1, obj2) {
				if (obj1.percent > obj2.percent) {
					return -1;
				}
				else if (obj1.percent < obj2.percent) {
					return 1;
				}
				
				return 0;
			}
		);
	},
	
	_getGrowthSum: function(unit) {
		// Gets the total growth rate of the unit
		
		var i, obj;
		var count = ParamGroup.getParameterCount();
		var weapon = ItemControl.getEquippedWeapon(unit);
		
		var sum = 0;
		
		for (i = 0; i < count; i++) {
			obj = {};
			obj.index = i;
			obj.percent = ParamGroup.getGrowthBonus(unit, i) + ParamGroup.getUnitTotalGrowthBonus(unit, i, weapon);
			
			sum += obj.percent;
		}
		
		return sum;
	},
	
	_getUncappedParams: function(unit) {
		var i;
		var count = ParamGroup.getParameterCount();
		var uncap = 0;
		var weapon = ItemControl.getEquippedWeapon(unit);
		
		for (i = 0; i < count; i++) {
			if (ParamGroup.getClassUnitValue(unit, i) != ParamGroup.getMaxValue(unit, i)) {
				n = ParamGroup.getGrowthBonus(unit, i) + ParamGroup.getUnitTotalGrowthBonus(unit, i, weapon);
				if (n > 0) {
					uncap += 1;
				}
			}
		}
		 
		return uncap;
	},
	
	_getMax: function(unit) {
		
		// Fixed mode
		if (BEXP_LEVEL_TYPE == 0) {
			return FIXED_STATS;
		}
		
		// Semi-fixed mode
		if (BEXP_LEVEL_TYPE == 1) {
			var growthSum = this._getGrowthSum(unit) / 100;
			var low = Math.floor(growthSum);
			var high = low + 1;
			var prob = (growthSum - low) * 100;
			if (Probability.getProbability(prob)) {
				return high;
			}
			else {
				return low;
			}
		}
		
	}
};