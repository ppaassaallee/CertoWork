# frozen_string_literal: true

# Idempotent Super Admin + Platform App bootstrap for Certo Work.
# FRONTEND_URL must remain https://certo.work.

require "json"
require "securerandom"

email = ENV.fetch("CERTO_ADMIN_EMAIL", "alejandro@getboldr.ai")
full_name = ENV.fetch("CERTO_ADMIN_NAME", "Alejandro Pascual")
generated_password = ENV.fetch("CERTO_ADMIN_PASSWORD") { "#{SecureRandom.alphanumeric(18)}Aa1!" }

::Redis::Alfred.delete(::Redis::Alfred::CHATWOOT_INSTALLATION_ONBOARDING)

account = Account.order(:id).first
user = User.find_by(email: email)
password_to_print = nil

if account.nil? || user.nil?
  user, account = AccountBuilder.new(
    account_name: "Certo Work",
    user_full_name: full_name,
    email: email,
    user_password: generated_password,
    super_admin: true,
    confirmed: true
  ).perform
  password_to_print = generated_password
else
  user.type = "SuperAdmin" if user.type != "SuperAdmin"
  user.confirm if user.respond_to?(:confirmed?) && !user.confirmed?
  user.save! if user.changed?
end

app = PlatformApp.find_or_create_by!(name: "Certo Work")
PlatformAppPermissible.find_or_create_by!(platform_app: app, permissible: account)
PlatformAppPermissible.find_or_create_by!(platform_app: app, permissible: user)
app.create_access_token if app.access_token.nil?
token = app.access_token.token
raise "Platform App access token missing" if token.to_s.empty?

payload = {
  CHATWOOT_ACCOUNT_ID: account.id,
  CHATWOOT_PLATFORM_TOKEN: token,
  ADMIN_EMAIL: email,
  ADMIN_PASSWORD: password_to_print
}
puts JSON.generate(payload)
