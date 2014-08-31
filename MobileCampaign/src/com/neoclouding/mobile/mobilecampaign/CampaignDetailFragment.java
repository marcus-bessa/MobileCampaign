package com.neoclouding.mobile.mobilecampaign;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.os.Bundle;
import android.telephony.SmsManager;
import android.view.LayoutInflater;
import android.view.View;
import android.view.View.OnClickListener;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import com.salesforce.androidsdk.app.SalesforceSDKManager;
import com.salesforce.androidsdk.ui.SalesforceR;

/***************************************************************************
 * MobileCampaign - CampaignDetailFragment Fragment that appears in the "content_frame", shows a campaign list
 **************************************************************************/
public class CampaignDetailFragment extends MobileCampaignFragment {

	public static final String ARG_RECORD_ID = "RECORD_ID";
	private static final int MAX_SMS_MESSAGE_LENGTH = 160;

	private SmsManager sms = SmsManager.getDefault();

	private View rootView;
	private ProgressBar progressBar;
	private Button btnSend;
	private TextView smsProgressBarMessage;

	private String campaignID;
	private String campaignName;
	private String smsMessage;
	private ArrayList<String> smsMessage_parts;

	/***************************************************************************
	 * Construtor padr‹o
	 **************************************************************************/
	public CampaignDetailFragment() {
		// Empty constructor required for fragment subclasses
	}

	/***************************************************************************
	 * MobileCampaign - onCreateView
	 **************************************************************************/
	@Override
	public View onCreateView(LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
		rootView = inflater.inflate(R.layout.fragment_campaign_detail, container, false);

		int i = getArguments().getInt(ARG_RECORD_ID);
		JSONArray records = (JSONArray) dataLoader.get(SalesforceDataLoader.SOBJ_CAMPAIGN);

		try {
			JSONObject campaign = records.getJSONObject(i);

			campaignID = campaign.getString("Id");

			TextView campaignNameView = (TextView) rootView.findViewById(R.id.campaign_name);
			campaignName = campaign.getString("Name");
			campaignNameView.setText(campaignName);

			TextView numberOfContactsView = (TextView) rootView.findViewById(R.id.numberOfContacts);
			numberOfContactsView.setText(campaign.getString("NumberOfContacts"));

			TextView numberOfAnswersView = (TextView) rootView.findViewById(R.id.numberOfAnswers);
			numberOfAnswersView.setText(campaign.getString("NumberOfResponses"));

			TextView sms_messageView = (TextView) rootView.findViewById(R.id.sms_message);
			smsMessage = campaign.getString("Mensagem_SMS__c");
			if (smsMessage.length() > MAX_SMS_MESSAGE_LENGTH) {
				smsMessage_parts = sms.divideMessage(smsMessage);
			}
			sms_messageView.setText(smsMessage);

			progressBar = (ProgressBar) rootView.findViewById(R.id.smsProgressBar);
			progressBar.setVisibility(ProgressBar.INVISIBLE);
			progressBar.setIndeterminate(true);

			smsProgressBarMessage = (TextView) rootView.findViewById(R.id.smsProgressBarMessage);
			smsProgressBarMessage.setVisibility(TextView.INVISIBLE);
			smsProgressBarMessage.setText("");

			btnSend = (Button) rootView.findViewById(R.id.Send_msg_Btn);
			btnSend.setVisibility(Button.VISIBLE);
			btnSend.setOnClickListener(new OnClickListener() {

				@Override
				public void onClick(View view) {
					try {
						btnSend.setVisibility(Button.INVISIBLE);
						progressBar.setVisibility(ProgressBar.VISIBLE);
						smsProgressBarMessage.setVisibility(TextView.VISIBLE);

						dataLoader.query(SalesforceDataLoader.SOBJ_CAMPAIGN_MEMBER,
								"SELECT ID, ContactId, Contact.MobilePhone FROM CampaignMember WHERE CAMPAIGNID = '" + campaignID
										+ "' and Status = 'aberto' LIMIT " + SalesforceDataLoader.LIMIT_MAX_RECORDS, new AbstractCommand() {

									private int sentMessages;
									private int failMessages;

									private boolean shouldContinue = true;

									@Override
									public void execute() throws Exception {
										JSONArray records = (JSONArray) this.args.get(ARG_RECORDS);

										sentMessages = 0;
										failMessages = 0;

										sendSMS(records);

										updateViewComponents();

										showDialog("Campanha enviada.");
									}

									/**
									 * SEND SMS
									 */
									private void sendSMS(JSONArray records) throws JSONException, IOException {
										int numberOfMembers = records.length();
										initViewComponentes(numberOfMembers);

										Date date = new Date();
										SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
										String today = sdf.format(date);

										Set<String> phones = new HashSet<String>();

										for (int i = 0; i < numberOfMembers; i++) {
											if (shouldContinue) {
												smsProgressBarMessage.setText("Enviando SMS (" + i + "/" + numberOfMembers + ")");

												final JSONObject campaignMember = records.getJSONObject(i);
												final JSONObject contact = campaignMember.getJSONObject("Contact");
												final String campaignMemberId = campaignMember.getString("Id");
												String phone_Num = contact.getString("MobilePhone");

												phone_Num = (phone_Num != null) ? (phone_Num.replaceAll("[^0-9]", "")) : "";

												// STEP 1 : SEND SMS
												boolean isSuccess = phones.contains(phone_Num) ? false : sendSMS(phone_Num);

												if (isSuccess) {
													smsProgressBarMessage.setText("Registrando tarefas (" + i + "/" + numberOfMembers + ")");

													final String contactID = campaignMember.getString("ContactId");

													// STEP 2 : CREATE RELATED TASK
													createTask(today, campaignID, contactID);

													// STEP 3 : UPDATE CAMPAIGN MEMBER STATUS
													updateCampaignMemberStatus_Success2Sent(campaignMemberId);

													phones.add(phone_Num);
													sentMessages++;

												} else {
													// IF FAIL : UPDATE CAMPAIGN MEMBER STATUS
													updateCampaignMemberStatus_Fail(campaignMemberId);

													failMessages++;

												}
											} else {
												break;
											}
										}
									}

									private boolean sendSMS(String phone_Num) {
										boolean result = false;

										if ((phone_Num.length() > 6)) {
											try {

												if (smsMessage.length() > MAX_SMS_MESSAGE_LENGTH) {

													for (int i = 0; i < smsMessage_parts.size(); i++) {
														sms.sendTextMessage(phone_Num, null, smsMessage_parts.get(i), null, null);
													}

												} else {
													sms.sendTextMessage(phone_Num, null, smsMessage, null, null);
												}

												result = true;

											} catch (Exception e) {
												Toast.makeText(getActivity(), "SMS not sent", Toast.LENGTH_SHORT).show();
												e.printStackTrace();
											}
										}

										return result;
									}

									private void createTask(String today, final String campaignId, final String contactID) throws IOException {
										Map<String, Object> fields = new HashMap<String, Object>();
										fields.put("WhoId", contactID);
										fields.put("WhatId", campaignId);
										fields.put("Status", "encerrada");
										fields.put("ActivityDate", today);
										fields.put("Subject", "SMS : " + campaignName);
										fields.put("Description", smsMessage);
										fields.put("RecordTypeId", "012A00000019doz");

										dataLoader.insert(SalesforceDataLoader.SOBJ_TASK, fields);
									}

									private void updateCampaignMemberStatus_Success2Sent(final String campaignMemberId) throws IOException {
										Map<String, Object> fields;
										fields = new HashMap<String, Object>();
										fields.put("Status", "enviado");

										dataLoader.update(SalesforceDataLoader.SOBJ_CAMPAIGN_MEMBER, campaignMemberId, fields);
									}

									private void updateCampaignMemberStatus_Fail(final String campaignMemberId) throws IOException {
										Map<String, Object> fields = new HashMap<String, Object>();
										fields.put("Status", "falha");
										dataLoader.update(SalesforceDataLoader.SOBJ_CAMPAIGN_MEMBER, campaignMemberId, fields);
									}

									private void updateViewComponents() {
										TextView numberOfMessagesSentView = (TextView) rootView.findViewById(R.id.numberOfMessagesSent);
										TextView numberOfFailsView = (TextView) rootView.findViewById(R.id.numberOfFails);
										numberOfMessagesSentView.setText(String.valueOf(sentMessages));
										numberOfFailsView.setText(String.valueOf(failMessages));

										progressBar.setVisibility(ProgressBar.INVISIBLE);
										smsProgressBarMessage.setVisibility(TextView.INVISIBLE);
									}

									private void initViewComponentes(int numberOfMembers) {
										progressBar.setMax(numberOfMembers);
										progressBar.setProgress(0);
										progressBar.setSecondaryProgress(0);
										progressBar.setIndeterminate(false);
										smsProgressBarMessage.setText("Enviando SMS ...");
									}

									private void showDialog(String msg) {
										final AlertDialog alertDialog = new AlertDialog.Builder(getActivity()).create();
										alertDialog.setTitle(campaignName);
										alertDialog.setMessage(msg);
										alertDialog.setButton(AlertDialog.BUTTON_NEUTRAL, "OK", new DialogInterface.OnClickListener() {
											public void onClick(DialogInterface dialog, int which) {
												alertDialog.dismiss();
											}
										});
										alertDialog.show();
									}

								});

					} catch (UnsupportedEncodingException e) {
						promptException(e);
						e.printStackTrace();

					} finally {
						hideProgressBar();
					}
				}

			});

		} catch (JSONException e) {
			promptException(e);
			e.printStackTrace();

		} finally {
			hideProgressBar();

		}

		return rootView;
	}

	private void hideProgressBar() {
		if (progressBar != null) {
			progressBar.setVisibility(ProgressBar.INVISIBLE);
			smsProgressBarMessage.setVisibility(TextView.INVISIBLE);
		}
	}

	private void promptException(Exception e) {
		SalesforceSDKManager instance = SalesforceSDKManager.getInstance();
		SalesforceR salesforceR = instance.getSalesforceR();
		int stringGenericError = salesforceR.stringGenericError();
		Activity activity = getActivity();
		String strException = activity.getString(stringGenericError, e.toString());

		Toast makeText = Toast.makeText(activity, strException, Toast.LENGTH_LONG);
		makeText.show();
	}

}