package com.neoclouding.mobile.mobilecampaign;

import java.util.Map;

public interface Command {

	public final String ARG_RECORDS = "RECORDS";
	
	public void execute() throws Exception;
	public void setArguments(Map<String, Object> args);
}
