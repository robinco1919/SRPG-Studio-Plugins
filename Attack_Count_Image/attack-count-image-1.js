/*------------------------------------------------------------------------------
Attack Count Image
Created by robinco

IMPORTANT: Only use this plugin if you are NOT using no-counter-pursuit.js!
If you aren't then use attack-count-image-2 instead.

Reaplces the Attack Count window in the battle forecast with an image next
to the Atk number showing the number of attacks.
Also changes the display in battle to be consistent.

Make sure to add the AttackCount folder to the Materials folder of your project.

25/07/2020 Initial release
------------------------------------------------------------------------------*/


// Info for attack count material
ATTACKCOUNT_SETTING = {
	  Folder     : 'AttackCount'
	, Img        : 'attackcount.png'
	, IconWidth  : 25
	, IconHeight : 14
};


// Overwritten function
StatusRenderer.drawAttackStatus = function(x, y, arr, color, font, space, count) {
	var i, text;
	var length = this._getTextLength();
	var numberSpace = DefineControl.getNumberSpace();
	var buf = ['attack_capacity', 'hit_capacity', 'critical_capacity'];
	
	// Determine whether to show the image.
	// The image is shown if count > 1
	var displayPic = (count > 1);
	
	// image
	var pic = root.getMaterialManager().createImage(ATTACKCOUNT_SETTING.Folder, ATTACKCOUNT_SETTING.Img);
	var width = ATTACKCOUNT_SETTING.IconWidth;
	var height = ATTACKCOUNT_SETTING.IconHeight;
	
	// Atk display updated to include image
		
	text = root.queryCommand(buf[0]);
	TextRenderer.drawKeywordText(x, y, text, length, color, font);
	
	if (displayPic && pic !== null) {
		var row = count - 1;
		x += 18 + numberSpace;
		if (arr[0] >= 0) {
			NumberRenderer.drawNumber(x, y, arr[0]);
			pic.drawParts(x + 12, y + 6, 0, row * height, width, height);
		}
		else {
			TextRenderer.drawSignText(x - 5, y, StringTable.SignWord_Limitless);
		}
		x += 45;
	}
	else {
		x += 20 + numberSpace;
		if (arr[0] >= 0) {
			NumberRenderer.drawNumber(x, y, arr[0]);
		}
		else {
			TextRenderer.drawSignText(x - 5, y, StringTable.SignWord_Limitless);
		}
		x += 20;
	}
	
	// Hit, Crt display mostly unchanged (only some minor spacing stuff)
	
	for (i = 1; i < 3; i++) {
		text = root.queryCommand(buf[i]);
		TextRenderer.drawKeywordText(x, y, text, length, color, font);
		if (displayPic) {
			x += 20 + numberSpace
		}
		else {
			x += 28 + numberSpace
		}
							
		if (arr[i] >= 0) {
			NumberRenderer.drawNumber(x, y, arr[i]);				
		}
		else {
			TextRenderer.drawSignText(x - 5, y, StringTable.SignWord_Limitless);
		}
		
		x += space;
	};
};


// Completely overwrite PosAttackWindow
var PosAttackWindow = defineObject(PosBaseWindow,
{
	_statusArray: null,
	_roundAttackCount: 0,
	
	setPosTarget: function(unit, item, targetUnit, targetItem, isSrc) {
		var isCalculation = false;
		
		if (item !== null && item.isWeapon()) {
			if (isSrc) {
				// If the player has launched an attack, the status can be obtained without conditions.
				this._statusArray = AttackChecker.getAttackStatusInternal(unit, item, targetUnit);
				isCalculation = true;
			}
			else {
				if (AttackChecker.isCounterattack(targetUnit, unit)) {
					this._statusArray = AttackChecker.getAttackStatusInternal(unit, item, targetUnit);
					isCalculation = true;
				}
				else {
					this._statusArray = AttackChecker.getNonStatus();	
				}
			}
		}
		else {
			this._statusArray = AttackChecker.getNonStatus();
		}
		
		if (isCalculation) {
			this._roundAttackCount = Calculator.calculateRoundCount(unit, targetUnit, item);
			this._roundAttackCount *= Calculator.calculateAttackCount(unit, targetUnit, item);
		}
		else {
			this._roundAttackCount = 0;
		}
		
		this.setPosInfo(unit, item, isSrc);		
	},
	
	drawInfo: function(xBase, yBase) {
		var textui, color, font, pic, x, y, text;
		
		PosBaseWindow.drawInfo.call(this, xBase, yBase);
		
		// Disable the default Attack Count window
		
		/*
		if (this._roundAttackCount < 2) {
			return;
		}
		
		textui = root.queryTextUI('attacknumber_title');
		color = textui.getColor();
		font = textui.getFont();
		pic = textui.getUIImage();
		x = xBase + 10;
		y = yBase + this.getWindowHeight() - 40;
		text = StringTable.AttackMenu_AttackCount + StringTable.SignWord_Multiple + this._roundAttackCount;
		TextRenderer.drawFixedTitleText(x, y, text, color, font, TextFormat.CENTER, pic, 4);
		*/
	},
	
	drawInfoBottom: function(xBase, yBase) {
		var x = xBase;
		var y = yBase + 90;
		var textui = this.getWindowTextUI();
		var color = ColorValue.KEYWORD;
		var font = textui.getFont();
		
		// Add rountAttackCount and roundCountReduced as an additional argument
		StatusRenderer.drawAttackStatus(x, y, this._statusArray, color, font, 20, this._roundAttackCount);
	}
}
);

// Battle UI stuff
// Normally the battle UI doesn't bother getting the attack count, so new functions
// have been added to UIBattleLayout
UIBattleLayout._getAttackCount = function(unit, targetUnit, isSrc) {
	var roundAttackCount, isCounterattack;
	
	if (isSrc) {
		roundAttackCount = Calculator.calculateRoundCount(unit, targetUnit,  BattlerChecker.getRealBattleWeapon(unit));
		roundAttackCount *= Calculator.calculateAttackCount(unit, targetUnit, BattlerChecker.getRealBattleWeapon(unit));
	}
	else {
		isCounterattack = this._realBattle.getAttackInfo().isCounterattack;
		if (isCounterattack) {
			roundAttackCount = Calculator.calculateRoundCount(targetUnit, unit,  BattlerChecker.getRealBattleWeapon(targetUnit));
			roundAttackCount *= Calculator.calculateAttackCount(targetUnit, unit, BattlerChecker.getRealBattleWeapon(targetUnit));
		}
		else {
			roundAttackCount = 1;
		}
	}
	
	return roundAttackCount;
};

// Overwritten functions of UIBattleLayout
UIBattleLayout.setBattlerAndParent = function (battlerRight, battlerLeft, realBattle) {
	var unit, targetUnit;
	
	this._realBattle = realBattle;
	this._battlerRight = battlerRight;
	this._battlerLeft = battlerLeft;

	this._gaugeRight = createObject(GaugeBar);
	this._gaugeLeft = createObject(GaugeBar);
	
	if (battlerRight.isSrc()) {
		unit = battlerRight.getUnit();
		targetUnit = battlerLeft.getUnit();
		
		this._gaugeRight.setGaugeInfo(unit.getHp(), ParamBonus.getMhp(unit), 1);
		this._gaugeLeft.setGaugeInfo(targetUnit.getHp(), ParamBonus.getMhp(targetUnit), 1);
		
		this._itemRight = BattlerChecker.getRealBattleWeapon(unit);
		this._itemLeft = BattlerChecker.getRealBattleWeapon(targetUnit);
	}
	else {
		unit = battlerLeft.getUnit();
		targetUnit = battlerRight.getUnit();
		
		this._gaugeRight.setGaugeInfo(targetUnit.getHp(), ParamBonus.getMhp(targetUnit), 1);
		this._gaugeLeft.setGaugeInfo(unit.getHp(), ParamBonus.getMhp(unit), 1);
		
		this._itemRight = BattlerChecker.getRealBattleWeapon(targetUnit);
		this._itemLeft = BattlerChecker.getRealBattleWeapon(unit);
	}
	
	this._gaugeLeft.setPartsCount(14);
	this._gaugeRight.setPartsCount(14);
	
	this._statusLeft = this._getAttackStatus(unit, targetUnit, battlerLeft.isSrc());
	this._statusRight = this._getAttackStatus(unit, targetUnit, battlerRight.isSrc());
	
	// new lines here
	this._attackCountLeft = this._getAttackCount(unit, targetUnit, battlerLeft.isSrc());
	this._attackCountRight = this._getAttackCount(unit, targetUnit, battlerRight.isSrc());
	
	this._scrollBackground = createObject(ScrollBackground);
	
	this._createBattleContainer(realBattle);
	
	this._isMoveEnd = false;	
};


UIBattleLayout._drawInfoArea = function(unit, isRight) {
	var x, y, arr;
	var dx = 10 + this._getIntervalX();
	var color = ColorValue.KEYWORD;
	var font = TextRenderer.getDefaultFont();
	
	if (isRight) {
		x = this._getBattleAreaWidth() - 205 - dx;
		arr = this._statusRight;
		count = this._attackCountRight;
	}
	else {
		x = dx;
		arr = this._statusLeft;
		count = this._attackCountLeft;
	}
	
	y = 65;
	StatusRenderer.drawAttackStatus(x, y, arr, color, font, 15, count);
};
