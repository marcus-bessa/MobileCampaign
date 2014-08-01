package com.neoclouding.mobile.mobilecampaign;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.util.HashMap;
import java.util.Map;

import org.json.JSONArray;
import org.json.JSONObject;

import android.app.Activity;
import android.widget.Toast;

import com.salesforce.androidsdk.app.SalesforceSDKManager;
import com.salesforce.androidsdk.rest.RestClient;
import com.salesforce.androidsdk.rest.RestClient.AsyncRequestCallback;
import com.salesforce.androidsdk.rest.RestRequest;
import com.salesforce.androidsdk.rest.RestResponse;
import com.salesforce.androidsdk.ui.SalesforceR;

public class SalesforceDataLoader {

	public static final String SOBJ_TASK = "Task";
	public static final String SOBJ_CAMPAIGN = "Campaign";
	public static final String SOBJ_CAMPAIGN_MEMBER = "CampaignMember";
	public static final String SOBJ_MENSAGEM__C = "Mensagem__c";
	protected static final int LIMIT_MAX_RECORDS = 200;

	private RestClient client;
	private String apiVersion;
	private Activity activity;

	private class Default_AsyncRequestCallback implements AsyncRequestCallback {

		public Default_AsyncRequestCallback() {
			super();
		}

		@Override
		public void onError(Exception exception) {
			SalesforceSDKManager instance = SalesforceSDKManager.getInstance();
			SalesforceR salesforceR = instance.getSalesforceR();
			int stringGenericError = salesforceR.stringGenericError();

			String strException = activity.getString(stringGenericError, exception.toString());

			Toast makeText = Toast.makeText(activity, strException, Toast.LENGTH_LONG);
			makeText.show();
		}

		@Override
		public void onSuccess(RestRequest request, RestResponse result) {
		}
	}

	private final class Query_AsyncRequestCallback extends Default_AsyncRequestCallback implements AsyncRequestCallback {

		private String sObjName;
		private Command cmd;

		public Query_AsyncRequestCallback(String sObjName, Command cmd) {
			super();
			this.sObjName = sObjName;
			this.cmd = cmd;
		}

		@Override
		public void onSuccess(RestRequest request, RestResponse result) {
			try {
				JSONObject jasonObj = result.asJSONObject();
				JSONArray records = jasonObj.getJSONArray("records");
				storage.put(sObjName, records);

				Map<String, Object> args = new HashMap<String, Object>();
				args.put(Command.ARG_RECORDS, records);
				cmd.setArguments(args);

				cmd.execute();

			} catch (Exception e) {
				onError(e);
			}
		}
	}

	private Map<String, JSONArray> storage = new HashMap<String, JSONArray>();

	public void clear() {
		storage.clear();
	}

	public boolean containsKey(String key) {
		return storage.containsKey(key);
	}

	public JSONArray get(String key) {
		return storage.get(key);
	}

	public JSONArray put(String key, JSONArray records) {
		return storage.put(key, records);
	}

	public JSONArray remove(String key) {
		return storage.remove(key);
	}

	public void setActivity(Activity activity) {
		this.activity = activity;
	}

	public void setApiVersion(String apiVersion) {
		this.apiVersion = apiVersion;
	}

	public void setClient(RestClient client) {
		this.client = client;
	}

	/***************************************************************************
	 * query
	 * 
	 * @throws UnsupportedEncodingException
	 **************************************************************************/
	public void query(final String sObjName, String soql, final Command cmd) throws UnsupportedEncodingException {
		RestRequest restRequest = RestRequest.getRequestForQuery(apiVersion, soql);
		client.sendAsync(restRequest, new Query_AsyncRequestCallback(sObjName, cmd));
	}

	/***************************************************************************
	 * insert
	 * 
	 * @throws IOException
	 **************************************************************************/
	public void insert(final String objectType, final Map<String, Object> fields) throws IOException {
		RestRequest restRequest = RestRequest.getRequestForCreate(apiVersion, objectType, fields);
		client.sendAsync(restRequest, new Default_AsyncRequestCallback());
	}

	/***************************************************************************
	 * update
	 * 
	 * @throws IOException
	 **************************************************************************/
	public void update(String objectType, String objectId, Map<String, Object> fields) throws IOException {
		RestRequest restRequest = RestRequest.getRequestForUpdate(apiVersion, objectType, objectId, fields);
		client.sendAsync(restRequest, new Default_AsyncRequestCallback());
	}

}
