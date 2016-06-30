# encoding: utf-8

module CartoDB
  module Importer2
    class PostgresConnector < BaseConnector
      # Requirements:
      #   * postgres_fdw extension must be installed in the user database

      # Temptative terminology
      # * connector channel (ODBC, ...)
      # * provider          (MySQL, ...)     [driver]
      # * connection        (database/query) [specific data source]

      def channel_name
        'postgres_fdw'
      end

      private

      def accepted_parameters
        %w(driver channel host port database table username password remote_schema)
      end

      def server_options
        %w(host port database)
      end

      def server_name
        server_string = [server_params['host'],
                         server_params['port'],
                         server_params['database']].join(';')
        server_hash = Digest::SHA1.hexdigest server_string
        srvname = "connector_#{channel_name}_#{server_hash}"
        print "IMPORTER: srvname = #{srvname}\n"
        srvname
      end

      def foreign_table_name
        v = @params['table']
        print "IMPORTER: foreign_table_name #{v}\n"
        v
      end

      def run_pre_create
        run_create_extension
        run_create_schema
      end

      def run_create_server
        server_count = execute_as_superuser %{SELECT * from pg_foreign_server WHERE srvname = '#{server_name}'}
        print "IMPORTER: server_count #{server_count.class} #{server_count}\n"
        if server_count == 0
          execute_as_superuser create_server_command
        end
      end

      def run_create_extension
        execute_as_superuser %{ CREATE EXTENSION IF NOT EXISTS #{channel_name} }
      end

      def run_create_schema
        execute_as_superuser %{ CREATE SCHEMA IF NOT EXISTS "#{@schema}" }
        execute_as_superuser %{ GRANT CREATE,USAGE ON SCHEMA "#{@schema}" TO postgres }
        execute_as_superuser %{ GRANT CREATE,USAGE ON SCHEMA "#{@schema}" TO "#{@user.database_username}" }
        execute_as_superuser %{ GRANT USAGE ON SCHEMA "#{@schema}" TO publicuser }
      end

      def create_server_command
        v = %{
          CREATE SERVER #{server_name}
            FOREIGN DATA WRAPPER #{@params['channel']}
            OPTIONS (
              host '#{server_params['host']}',
              dbname '#{server_params['database']}',
              port '#{server_params['port']}'
            )
        }
        print "IMPORTER: create_server_command #{v}\n"
        v
      end

      def run_create_user_mapping
        for usename in [@user.database_username, 'postgres']
          user_mapping_count = execute_as_superuser %{
            SELECT *
            FROM pg_user_mappings
            WHERE srvname = '#{server_name}' AND usename = '#{usename}'
          }
          print "IMPORTER: user_mapping_count #{user_mapping_count.class} #{user_mapping_count}"
          if user_mapping_count == 0
            execute_as_superuser %{
              CREATE USER MAPPING FOR "#{usename}" SERVER #{server_name}
                OPTIONS ( user '#{@params['username']}', password '#{@params['password']}');
            }
          end
        end
      end

      def create_foreign_table_command
        v = %{
          IMPORT FOREIGN SCHEMA #{@schema} LIMIT TO (#{foreign_table_name})
            FROM SERVER #{server_name} INTO #{@schema};
          ALTER FOREIGN TABLE #{@schema}.#{foreign_table_name} OWNER TO "#{@user.database_username}";
          GRANT SELECT ON #{@schema}.#{foreign_table_name} TO publicuser;
          CREATE VIEW #{@user.database_schema}.#{foreign_table_name} AS SELECT * FROM #{@schema}.#{foreign_table_name};
        }
        print "IMPORTER: create_foreign_table_command #{v}\n"
        v
      end

      def run_post_create
        # Ensure here that the remote cdb_tablemetadata are imported
        begin
          execute_as_superuser %{select '#{@schema}.cdb_tablemetadata'::regclass}
        rescue => e
          execute_as_superuser %{
            CREATE FOREIGN TABLE #{@schema}.cdb_tablemetadata (tabname text, updated_at timestamp with time zone)
              SERVER #{server_name}
              OPTIONS (table_name 'cdb_tablemetadata_text', schema_name 'cartodb', updatable 'false');
            GRANT SELECT ON #{@schema}.cdb_tablemetadata TO publicuser;
          }
        end
      end

      def run_post_create_ensure
        print "IMPORTER: NOOP run_post_create_ensure\n"
      end
    end
  end
end
