package com.neoclouding.mobile.mobilecampaign;

import java.util.Map;

public abstract class AbstractCommand implements Command {

	protected Map<String, Object> args;
	
	@Override
	public void setArguments(Map<String, Object> args) {
		this.args = args;
	}

}
