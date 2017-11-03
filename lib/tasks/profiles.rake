namespace :profiles do
  namespace :enable do
    desc 'Enable a username for a profile'
    task :user, [:username, :profile_name] => [:environment] do |task, args|
      raise 'Please specify the username to be enabled' if args[:username].blank?
      raise "Please specify the profile_name for which to enable #{args[:username]}" if args[:profile_name].blank?

      user = User.where(username: args[:username]).first
      raise "The username '#{args[:username]}' does not correspond to any user" if user.nil?

      profile = Profile.where(name: args[:profile_name]).first
      raise "The profile_name '#{args[:profile_name]}' does not correspond to any profile" if profile.nil?

      profiles_user = ProfilesUser.where(profile_id: profile.id, user_id: user.id).first
      if profiles_user
        puts "User #{user.username} already enabled for profile #{profile.name} - skipping."
      else
        ProfilesUser.insert(profile_id: profile.id, user_id: user.id)
      end
    end
  end
end

