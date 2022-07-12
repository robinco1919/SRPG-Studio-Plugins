/*--------------------------------------------------------------------------
No Counter Pursuit
Created by robinco

* Prevent pursuit/follow-up attacks when not initiatingcombat
* Can set a custom skill which allows units to follow-up like normal

To create the skill which enables follow-up attacks when countering, create
a custom skill with the keyword "CounterPursuit"

25/07/2020 Initial release
--------------------------------------------------------------------------*/



// new function
// returns true if unit is blocked from making extra attacks due to not initiating attack
Calculator.roundCountReduced = function(active, passive, weapon) {
	
	var activeAgi;
	var passiveAgi;
	var value;

	activeAgi = AbilityCalculator.getAgility(active, weapon);
	passiveAgi = AbilityCalculator.getAgility(passive, ItemControl.getEquippedWeapon(passive));
	value = this.getDifference();
	
	var isInit = ((root.getCurrentSession().getTurnType() === TurnType.PLAYER && active.getUnitType() === UnitType.PLAYER)
	|| (root.getCurrentSession().getTurnType() === TurnType.ALLY && active.getUnitType() === UnitType.ALLY)
	|| (root.getCurrentSession().getTurnType() === TurnType.ENEMY && active.getUnitType() === UnitType.ENEMY));
	
	if (SkillControl.getPossessionCustomSkill(active, 'CounterPursuit') !== null) {return false}
	
	if ((activeAgi - passiveAgi) >= value) {
		return !isInit
	}
	else {
		return false;
	}
};


(function() {
	var alias1 = Calculator.calculateRoundCount

	Calculator.calculateRoundCount = function(active, passive, weapon) {
		
		var count = alias1.call(this, active, passive, weapon)
		
		var countReduced = this.roundCountReduced(active, passive, weapon);
		
		if (countReduced) {
			count = 1;
		}
		
		return count;
		
	};

})();