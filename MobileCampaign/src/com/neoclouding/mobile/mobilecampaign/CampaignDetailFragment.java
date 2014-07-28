package com.neoclouding.mobile.mobilecampaign;

import java.io.UnsupportedEncodingException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
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
 * MobileCampaign - CampaignDetailFragment 
 * Fragment that appears in the "content_frame", shows a campaign list
 **************************************************************************/
public class CampaignDetailFragment extends MobileCampaignFragment {

	public  static final String ARG_RECORD_ID   = "RECORD_ID";
	private static final int MAX_SMS_MESSAGE_LENGTH = 160;

	private String campaignID;
	private String campaignName;
	private String smsMessage;
	private ArrayList<String> smsMessage_parts;
	private SmsManager sms = SmsManager.getDefault();  

	private View rootView;
	private ProgressBar progressBar;
	private Button btnSend;
	private TextView smsProgressBarMessage;

	private List<JSONObject> sentMessages;
	private List<JSONObject> failMessages;

	private boolean shouldContinue = true;

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
		JSONArray records = (JSONArray)dataLoader.get(SalesforceDataLoader.SOBJ_CAMPAIGN);

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
			if (smsMessage.length()>MAX_SMS_MESSAGE_LENGTH) {
				smsMessage_parts = sms.divideMessage(smsMessage);
			}
			sms_messageView.setText(smsMessage);

			progressBar  = (ProgressBar) rootView.findViewById(R.id.smsProgressBar);
			progressBar.setVisibility(ProgressBar.INVISIBLE);
			progressBar.setIndeterminate(true);

			smsProgressBarMessage = (TextView) rootView.findViewById(R.id.smsProgressBarMessage);
			smsProgressBarMessage.setVisibility(TextView.INVISIBLE);
			smsProgressBarMessage.setText("");

			btnSend = (Button) rootView.findViewById(R.id.Send_msg_Btn);
			btnSend.setVisibility(Button.VISIBLE);
			btnSend.setOnClickListener(new OnClickListener() {

				private boolean sendSMS(String phone_Num) {
					boolean result = false;

					if ((phone_Num.length()>6)) {
						try {

							if (smsMessage.length() > MAX_SMS_MESSAGE_LENGTH) {

								for(int i=0;i<smsMessage_parts.size();i++){
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

				@Override
				public void onClick(View view) {
					try {
						btnSend.setVisibility(Button.INVISIBLE);
						progressBar.setVisibility(ProgressBar.VISIBLE);
						smsProgressBarMessage.setVisibility(TextView.VISIBLE);

						dataLoader.query( SalesforceDataLoader.SOBJ_CAMPAIGN_MEMBER
								, "SELECT ID, CampaignId, ContactId, Contact.MobilePhone FROM CampaignMember WHERE CAMPAIGNID = '" + campaignID + "' and Status = 'aberto'"
								, new AbstractCommand() {
							@Override
							public void execute() throws Exception {
								JSONArray records = (JSONArray)this.args.get(ARG_RECORDS);
								int numberOfMembers = records.length();

								progressBar.setMax(numberOfMembers);
								progressBar.setProgress(0);
								progressBar.setSecondaryProgress(0);
								progressBar.setIndeterminate(false);
								smsProgressBarMessage.setText("Enviando SMS ...");

								sentMessages = new ArrayList<JSONObject>();
								failMessages = new ArrayList<JSONObject>();

								TextView numberOfMessagesSentView = (TextView) rootView.findViewById(R.id.numberOfMessagesSent);
								TextView numberOfFailsView = (TextView) rootView.findViewById(R.id.numberOfFails);

								Set<String> phones = new HashSet<String>();

								for (int i = 0; i < numberOfMembers; i++) {
									if (shouldContinue) {
										smsProgressBarMessage.setText("Enviando SMS (" + i + "/" + numberOfMembers + ")");

										final JSONObject campaignMember = records.getJSONObject(i);
										final JSONObject contact = campaignMember.getJSONObject("Contact");
										String phone_Num = contact.getString("MobilePhone");

										phone_Num = (phone_Num!=null)?(phone_Num.replaceAll("[^0-9]", "")):"";
										boolean isSuccess = phones.contains(phone_Num)?false:sendSMS(phone_Num);

										if (isSuccess) {
											sentMessages.add(campaignMember);
											progressBar.setProgress(sentMessages.size());
											phones.add(phone_Num);

										} else {
											failMessages.add(campaignMember);
											progressBar.setSecondaryProgress(failMessages.size());
										}
									} else {
										break;
									}

								}

								progressBar.setMax(sentMessages.size());
								progressBar.setProgress(0);
								progressBar.setSecondaryProgress(0);
								smsProgressBarMessage.setText("Registrando tarefas ...");

								Date date = new Date();
								SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
								String today = sdf.format(date);
								int i = 1;

								for(JSONObject campaignMember : sentMessages) {
									smsProgressBarMessage.setText("Registrando tarefas (" + i++ + "/" + sentMessages.size() + ")");

									final String campaignMemberId = campaignMember.getString("Id");
									final String campaignId = campaignMember.getString("CampaignId");
									final String contactID = campaignMember.getString("ContactId");

									Map<String, Object> fields = new HashMap<String, Object>();
									fields.put("WhoId", contactID);
									fields.put("WhatId", campaignId);
									fields.put("Status", "encerrada");
									fields.put("ActivityDate", today);
									fields.put("Subject", "SMS : " + campaignName);
									fields.put("Description", smsMessage);
									fields.put("RecordTypeId", "012A00000019doz");

									dataLoader.insert(SalesforceDataLoader.SOBJ_TASK, fields);

									fields = new HashMap<String, Object>();
									fields.put("Status", "enviado");
									dataLoader.update(SalesforceDataLoader.SOBJ_CAMPAIGN_MEMBER, campaignMemberId, fields);

									progressBar.incrementProgressBy(1);
								}

								progressBar.setMax(failMessages.size());
								progressBar.setProgress(0);
								smsProgressBarMessage.setText("Registrando falhas de envio ...");

								for(JSONObject campaignMember : failMessages) {
									smsProgressBarMessage.setText("Registrando falhas de envio (" + i++ + "/" + sentMessages.size() + ")");

									final String campaignMemberId = campaignMember.getString("Id");

									Map<String, Object> fields = new HashMap<String, Object>();
									fields.put("Status", "falha");
									dataLoader.update(SalesforceDataLoader.SOBJ_CAMPAIGN_MEMBER, campaignMemberId, fields);

									progressBar.incrementProgressBy(1);
								}

								numberOfMessagesSentView.setText(String.valueOf(sentMessages.size()));
								numberOfFailsView.setText(String.valueOf(failMessages.size()));

								progressBar.setVisibility(ProgressBar.INVISIBLE);
								smsProgressBarMessage.setVisibility(TextView.INVISIBLE);

								final AlertDialog alertDialog = new AlertDialog.Builder(getActivity()).create();
								alertDialog.setTitle(campaignName);
								alertDialog.setMessage("Campanha enviada.");
								alertDialog.setButton(AlertDialog.BUTTON_NEUTRAL, "OK", new DialogInterface.OnClickListener() {
									public void onClick(DialogInterface dialog, int which) {
										alertDialog.dismiss();
									}
								});
								alertDialog.show();
								//								Toast.makeText(getActivity(), "Campanha enviada.", Toast.LENGTH_SHORT).show();
							}
						});

					} catch (UnsupportedEncodingException e) {
						SalesforceSDKManager instance = SalesforceSDKManager.getInstance();
						SalesforceR salesforceR = instance.getSalesforceR();
						int stringGenericError = salesforceR.stringGenericError();
						Activity activity = getActivity();
						String strException = activity.getString(stringGenericError, e.toString());

						Toast makeText = Toast.makeText(activity, strException, Toast.LENGTH_LONG);
						makeText.show();

						e.printStackTrace();

					} finally {
						if(progressBar!=null) {
							progressBar.setVisibility(ProgressBar.INVISIBLE);
							smsProgressBarMessage.setVisibility(TextView.INVISIBLE);
						}
					}
				}

			});

		} catch (JSONException e) {
			SalesforceSDKManager instance = SalesforceSDKManager.getInstance();
			SalesforceR salesforceR = instance.getSalesforceR();
			int stringGenericError = salesforceR.stringGenericError();
			Activity activity = getActivity();
			String strException = activity.getString(stringGenericError, e.toString());

			Toast makeText = Toast.makeText(activity, strException, Toast.LENGTH_LONG);
			makeText.show();

			e.printStackTrace();

		} finally {
			if(progressBar!=null) {
				progressBar.setVisibility(ProgressBar.INVISIBLE);
				smsProgressBarMessage.setVisibility(TextView.INVISIBLE);
			}

		}

		return rootView;
	}

}